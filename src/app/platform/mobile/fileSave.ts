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

const toBlob = async (data: Blob | string): Promise<Blob> => {
  if (typeof data !== 'string') return data;
  const response = await fetch(data);
  return response.blob();
};

const runSaveFile = async (data: Blob | string, filename: string): Promise<string | undefined> => {
  const bridge = getBridge();
  if (!bridge) throw new Error('The file save bridge is unavailable');

  const blob = await toBlob(data);
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

    for (let offset = 0; offset < blob.size; offset += SAVE_CHUNK_SIZE_BYTES) {
      const chunk = blob.slice(offset, offset + SAVE_CHUNK_SIZE_BYTES);
      await session.send(await chunk.arrayBuffer());
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
  data: Blob | string,
  filename: string
): Promise<string | undefined> => {
  const queuedSave = saveQueue.then(
    () => runSaveFile(data, filename),
    () => runSaveFile(data, filename)
  );
  saveQueue = queuedSave.catch(() => undefined);
  return queuedSave;
};
