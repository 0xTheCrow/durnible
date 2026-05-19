import type { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';

let worker: Worker | null = null;
type PendingEntry = {
  resolve: (v: { data: ArrayBuffer; info: EncryptedAttachmentInfo }) => void;
  reject: (e: unknown) => void;
};
const pending = new Map<string, PendingEntry>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/encryptAttachment.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = ({ data }) => {
      const entry = pending.get(data.id);
      if (!entry) return;
      pending.delete(data.id);
      if (data.error) entry.reject(new Error(data.error));
      else entry.resolve({ data: data.data, info: data.info });
    };
  }
  return worker;
}

function encryptBufferInWorker(
  buffer: ArrayBuffer
): Promise<{ data: ArrayBuffer; info: EncryptedAttachmentInfo }> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, buffer }, [buffer]);
  });
}

export async function encryptFileInWorker(
  file: File
): Promise<{ encryptionInfo: EncryptedAttachmentInfo; file: File; originalFile: File }> {
  const buffer = await file.arrayBuffer();
  const { data, info } = await encryptBufferInWorker(buffer);
  const encFile = new File([data], file.name, { type: file.type });
  return { encryptionInfo: info, file: encFile, originalFile: file };
}
