import { checkIsNativeMobileApp } from '.';

const BRIDGE_OBJECT_NAME = 'durnibleFileSave';

export const SAVE_CHUNK_SIZE_BYTES = 4 * 1024 * 1024;

type BridgeReply =
  | { type: 'acknowledged' }
  | { type: 'cancelled' }
  | { type: 'done'; savedTo: string }
  | { type: 'error'; message: string };

type MobileFileSaveBridge = {
  postMessage: (payload: string | ArrayBuffer) => void;
  addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
  removeEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
};

const getBridge = (): MobileFileSaveBridge | undefined =>
  (window as unknown as Record<string, MobileFileSaveBridge | undefined>)[BRIDGE_OBJECT_NAME];

export const checkIsMobileFileSaveSupported = (): boolean =>
  checkIsNativeMobileApp() && getBridge() !== undefined;

class MobileFileSaveSession {
  private readonly bridge: MobileFileSaveBridge;

  private pendingReply: {
    resolve: (reply: BridgeReply) => void;
    reject: (error: Error) => void;
  } | null = null;

  private readonly handleMessage = (event: MessageEvent) => {
    const pending = this.pendingReply;
    if (!pending) return;
    this.pendingReply = null;
    try {
      pending.resolve(JSON.parse(String(event.data)) as BridgeReply);
    } catch {
      pending.reject(new Error('Malformed reply from the file save bridge'));
    }
  };

  constructor(bridge: MobileFileSaveBridge) {
    this.bridge = bridge;
    this.bridge.addEventListener('message', this.handleMessage);
  }

  dispose(): void {
    this.bridge.removeEventListener('message', this.handleMessage);
    this.pendingReply?.reject(new Error('File save bridge closed'));
    this.pendingReply = null;
  }

  private request(payload: string | ArrayBuffer): Promise<BridgeReply> {
    if (this.pendingReply) {
      return Promise.reject(new Error('A file save request is already awaiting a reply'));
    }
    return new Promise<BridgeReply>((resolve, reject) => {
      this.pendingReply = { resolve, reject };
      try {
        this.bridge.postMessage(payload);
      } catch (error) {
        this.pendingReply = null;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async send(payload: string | ArrayBuffer): Promise<BridgeReply> {
    const reply = await this.request(payload);
    if (reply.type === 'error') throw new Error(reply.message);
    return reply;
  }
}

const runSaveFile = async (
  blob: Blob,
  filename: string,
  reportSavePercent?: (percent: number) => void
): Promise<string | undefined> => {
  const bridge = getBridge();
  if (!bridge) throw new Error('The file save bridge is unavailable');

  const session = new MobileFileSaveSession(bridge);
  let isBegun = false;

  try {
    const beginReply = await session.send(
      JSON.stringify({
        type: 'begin',
        filename,
        mimeType: blob.type || 'application/octet-stream',
      })
    );
    if (beginReply.type === 'cancelled') return undefined;
    isBegun = true;

    reportSavePercent?.(0);
    for (let offset = 0; offset < blob.size; offset += SAVE_CHUNK_SIZE_BYTES) {
      const chunkEnd = Math.min(offset + SAVE_CHUNK_SIZE_BYTES, blob.size);
      await session.send(await blob.slice(offset, chunkEnd).arrayBuffer());
      reportSavePercent?.(Math.floor((chunkEnd / blob.size) * 100));
    }

    const reply = await session.send(JSON.stringify({ type: 'finish' }));
    return reply.type === 'done' ? reply.savedTo : undefined;
  } catch (error) {
    if (isBegun) {
      await session.send(JSON.stringify({ type: 'abort' })).catch(() => undefined);
    }
    throw error;
  } finally {
    session.dispose();
  }
};

let saveQueue: Promise<unknown> = Promise.resolve();

export const saveFileOnMobile = (
  blob: Blob,
  filename: string,
  reportSavePercent?: (percent: number) => void
): Promise<string | undefined> => {
  const queuedSave = saveQueue.then(
    () => runSaveFile(blob, filename, reportSavePercent),
    () => runSaveFile(blob, filename, reportSavePercent)
  );
  saveQueue = queuedSave.catch(() => undefined);
  return queuedSave;
};
