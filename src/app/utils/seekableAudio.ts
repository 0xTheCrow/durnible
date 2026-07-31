const UNSEEKABLE_AUDIO_MIME_TYPES = ['audio/webm', 'audio/ogg'];

export const MAX_TRANSCODE_DURATION_MS = 5 * 60 * 1000;

const WAV_HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = 2;

const writeAscii = (view: DataView, offset: number, text: string) => {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
};

export const encodeWav = (audioBuffer: AudioBuffer): ArrayBuffer => {
  const { numberOfChannels, sampleRate, length } = audioBuffer;
  const blockAlign = numberOfChannels * BYTES_PER_SAMPLE;
  const dataLength = length * blockAlign;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataLength);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  const channels: Float32Array[] = [];
  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    channels.push(audioBuffer.getChannelData(channel));
  }

  let offset = WAV_HEADER_BYTES;
  for (let frame = 0; frame < length; frame += 1) {
    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += BYTES_PER_SAMPLE;
    }
  }

  return buffer;
};

export const checkIsUnseekableAudioMimeType = (mimeType: string): boolean =>
  UNSEEKABLE_AUDIO_MIME_TYPES.some((unseekable) => mimeType.startsWith(unseekable));

export const toSeekableAudio = async (
  content: Blob,
  mimeType: string,
  durationMs?: number
): Promise<Blob> => {
  if (!checkIsUnseekableAudioMimeType(mimeType)) return content;
  if (durationMs === undefined || durationMs <= 0 || durationMs > MAX_TRANSCODE_DURATION_MS) {
    return content;
  }

  try {
    const audioContext = new AudioContext();
    try {
      const audioBuffer = await audioContext.decodeAudioData(await content.arrayBuffer());
      return new Blob([encodeWav(audioBuffer)], { type: 'audio/wav' });
    } finally {
      await audioContext.close();
    }
  } catch {
    return content;
  }
};
