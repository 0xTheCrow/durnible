import { app, ipcMain } from 'electron';
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { open, unlink } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import path from 'node:path';

const VIDEO_TRANSCODE_START_CHANNEL = 'durnible:video-transcode:start';
const VIDEO_TRANSCODE_CANCEL_CHANNEL = 'durnible:video-transcode:cancel';

const SHARED_MEMORY_DIRECTORY = '/dev/shm';
const INPUT_FILE_DESCRIPTOR = 3;
const FFMPEG_COMMAND = 'ffmpeg';
const FFMPEG_ARGUMENTS = [
  '-hide_banner',
  '-nostdin',
  '-loglevel',
  'error',
  '-protocol_whitelist',
  'file',
  '-f',
  'mov',
  '-i',
  `file:/proc/self/fd/${INPUT_FILE_DESCRIPTOR}`,
  '-map',
  '0:v:0',
  '-map',
  '0:a:0?',
  '-c:v',
  'libx264',
  '-preset',
  'ultrafast',
  '-crf',
  '18',
  '-pix_fmt',
  'yuv420p',
  '-c:a',
  'aac',
  '-movflags',
  'frag_keyframe+empty_moov+default_base_moof',
  '-f',
  'mp4',
  'pipe:1',
];

const MAX_CONCURRENT_TRANSCODES = 2;
const TRANSCODE_TIMEOUT_MS = 5 * 60 * 1000;
const TRANSCODE_INPUT_LIMIT_BYTES = 1024 * 1024 * 1024;
const TRANSCODE_OUTPUT_LIMIT_BYTES = 1024 * 1024 * 1024;

type VideoTranscodeResult =
  | { status: 'success'; bytes: Uint8Array }
  | { status: 'ffmpeg-missing' }
  | { status: 'failed' }
  | { status: 'cancelled' };

type TranscodeSlotWaiter = { grantSlot: () => void };

const abortControllersByRequestId = new Map<string, AbortController>();
const transcodeSlotWaiters: TranscodeSlotWaiter[] = [];
let runningTranscodeCount = 0;

const acquireTranscodeSlot = (signal: AbortSignal): Promise<boolean> => {
  if (runningTranscodeCount < MAX_CONCURRENT_TRANSCODES) {
    runningTranscodeCount += 1;
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const waiter: TranscodeSlotWaiter = { grantSlot: () => undefined };
    const handleAbort = (): void => {
      transcodeSlotWaiters.splice(transcodeSlotWaiters.indexOf(waiter), 1);
      resolve(false);
    };
    waiter.grantSlot = () => {
      signal.removeEventListener('abort', handleAbort);
      runningTranscodeCount += 1;
      resolve(true);
    };
    transcodeSlotWaiters.push(waiter);
    signal.addEventListener('abort', handleAbort, { once: true });
  });
};

const releaseTranscodeSlot = (): void => {
  runningTranscodeCount -= 1;
  transcodeSlotWaiters.shift()?.grantSlot();
};

const createUnlinkedSharedMemoryFile = async (bytes: Uint8Array): Promise<FileHandle> => {
  const filePath = path.join(SHARED_MEMORY_DIRECTORY, `durnible-video-transcode-${randomUUID()}`);
  const fileHandle = await open(filePath, 'wx', 0o600);
  try {
    await unlink(filePath);
    await fileHandle.writeFile(bytes);
    return fileHandle;
  } catch (error) {
    await fileHandle.close();
    throw error;
  }
};

const runFfmpegTranscode = (
  inputFileDescriptor: number,
  signal: AbortSignal
): Promise<VideoTranscodeResult> =>
  new Promise((resolve) => {
    const ffmpegProcess = spawn(FFMPEG_COMMAND, FFMPEG_ARGUMENTS, {
      stdio: ['ignore', 'pipe', 'ignore', inputFileDescriptor],
    });
    const outputChunks: Buffer[] = [];
    let outputByteCount = 0;
    let isSettled = false;

    const settle = (result: VideoTranscodeResult): void => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', handleAbort);
      resolve(result);
    };
    const killAndSettle = (result: VideoTranscodeResult): void => {
      ffmpegProcess.kill('SIGKILL');
      settle(result);
    };
    const handleAbort = (): void => killAndSettle({ status: 'cancelled' });
    const timeout = setTimeout(() => killAndSettle({ status: 'failed' }), TRANSCODE_TIMEOUT_MS);
    signal.addEventListener('abort', handleAbort, { once: true });

    ffmpegProcess.on('error', (error: NodeJS.ErrnoException) => {
      settle(error.code === 'ENOENT' ? { status: 'ffmpeg-missing' } : { status: 'failed' });
    });
    ffmpegProcess.stdout?.on('data', (chunk: Buffer) => {
      outputByteCount += chunk.length;
      if (outputByteCount > TRANSCODE_OUTPUT_LIMIT_BYTES) {
        killAndSettle({ status: 'failed' });
        return;
      }
      outputChunks.push(chunk);
    });
    ffmpegProcess.on('close', (exitCode) => {
      settle(
        exitCode === 0 && outputByteCount > 0
          ? { status: 'success', bytes: Buffer.concat(outputChunks) }
          : { status: 'failed' }
      );
    });
  });

const transcodeVideoFromSharedMemory = async (
  inputBytes: Uint8Array,
  signal: AbortSignal
): Promise<VideoTranscodeResult> => {
  let inputFile: FileHandle;
  try {
    inputFile = await createUnlinkedSharedMemoryFile(inputBytes);
  } catch {
    return { status: 'failed' };
  }
  try {
    if (signal.aborted) return { status: 'cancelled' };
    return await runFfmpegTranscode(inputFile.fd, signal);
  } finally {
    await inputFile.close();
  }
};

const transcodeVideo = async (
  inputBytes: Uint8Array,
  signal: AbortSignal
): Promise<VideoTranscodeResult> => {
  const isSlotAcquired = await acquireTranscodeSlot(signal);
  if (!isSlotAcquired) return { status: 'cancelled' };
  try {
    return await transcodeVideoFromSharedMemory(inputBytes, signal);
  } finally {
    releaseTranscodeSlot();
  }
};

export const installVideoTranscode = (
  checkIsTrustedSender: (event: IpcMainEvent | IpcMainInvokeEvent) => boolean
): void => {
  ipcMain.handle(
    VIDEO_TRANSCODE_START_CHANNEL,
    async (event, requestId: unknown, inputBytes: unknown): Promise<VideoTranscodeResult> => {
      if (
        process.platform !== 'linux' ||
        !checkIsTrustedSender(event) ||
        typeof requestId !== 'string' ||
        abortControllersByRequestId.has(requestId) ||
        !(inputBytes instanceof Uint8Array) ||
        inputBytes.byteLength > TRANSCODE_INPUT_LIMIT_BYTES
      ) {
        return { status: 'failed' };
      }

      const abortController = new AbortController();
      const abortTranscode = (): void => abortController.abort();
      const { sender } = event;
      abortControllersByRequestId.set(requestId, abortController);
      sender.once('destroyed', abortTranscode);
      sender.once('render-process-gone', abortTranscode);
      sender.once('did-navigate', abortTranscode);
      try {
        return await transcodeVideo(inputBytes, abortController.signal);
      } finally {
        abortControllersByRequestId.delete(requestId);
        sender.removeListener('destroyed', abortTranscode);
        sender.removeListener('render-process-gone', abortTranscode);
        sender.removeListener('did-navigate', abortTranscode);
      }
    }
  );

  ipcMain.on(VIDEO_TRANSCODE_CANCEL_CHANNEL, (event, requestId: unknown) => {
    if (!checkIsTrustedSender(event) || typeof requestId !== 'string') return;
    abortControllersByRequestId.get(requestId)?.abort();
  });

  app.on('will-quit', () => {
    abortControllersByRequestId.forEach((abortController) => abortController.abort());
  });
};
