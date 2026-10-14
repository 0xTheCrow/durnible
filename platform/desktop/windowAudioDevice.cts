import os from 'node:os';

const APPLICATION_LOOPBACK_DEVICE_PREFIX = 'applicationLoopback';
const PROCESS_LOOPBACK_MINIMUM_WINDOWS_BUILD = 20348;
const WINDOW_SOURCE_ID_PATTERN = /^window:(\d+):/;

type GetWindowThreadProcessId = (windowHandle: number, processId: number[]) => number;

let getWindowThreadProcessIdPromise: Promise<GetWindowThreadProcessId> | undefined;

const loadGetWindowThreadProcessId = (): Promise<GetWindowThreadProcessId> => {
  getWindowThreadProcessIdPromise ??= import('koffi').then(({ load }) => {
    const user32 = load('user32.dll');
    const getWindowThreadProcessId: GetWindowThreadProcessId = user32.func(
      'uint32_t __stdcall GetWindowThreadProcessId(intptr_t windowHandle, _Out_ uint32_t *processId)'
    );
    return getWindowThreadProcessId;
  });
  return getWindowThreadProcessIdPromise;
};

const checkIsProcessLoopbackSupported = (): boolean => {
  const windowsBuild = Number(os.release().split('.')[2]);
  return windowsBuild >= PROCESS_LOOPBACK_MINIMUM_WINDOWS_BUILD;
};

const findWindowProcessId = async (windowHandle: number): Promise<number | undefined> => {
  const getWindowThreadProcessId = await loadGetWindowThreadProcessId();
  const processId = [0];
  const threadId = getWindowThreadProcessId(windowHandle, processId);
  if (threadId === 0 || processId[0] === 0) return undefined;
  return processId[0];
};

export const findWindowAudioDeviceId = async (sourceId: string): Promise<string | undefined> => {
  if (process.platform !== 'win32' || !checkIsProcessLoopbackSupported()) return undefined;
  const windowHandleMatch = sourceId.match(WINDOW_SOURCE_ID_PATTERN);
  if (!windowHandleMatch) return undefined;

  const windowProcessId = await findWindowProcessId(Number(windowHandleMatch[1])).catch(
    () => undefined
  );
  if (windowProcessId === undefined || windowProcessId === process.pid) return undefined;
  return `${APPLICATION_LOOPBACK_DEVICE_PREFIX}:${windowProcessId}`;
};
