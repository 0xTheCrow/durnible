import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MsgType } from 'matrix-js-sdk';
import type { UploadItem, UploadMediaInfo } from '../../../state/room/roomInputDrafts';
import * as matrixUtils from '../../../utils/matrix';
import { getAudioMsgContent } from './msgContent';

vi.mock('../../../utils/matrix', async (importOriginal) => {
  const actual = await importOriginal<typeof matrixUtils>();
  return {
    ...actual,
    probeAudioDurationMs: vi.fn(),
  };
});

const probeMock = vi.mocked(matrixUtils.probeAudioDurationMs);

const MXC = 'mxc://example.org/abc123';

const makeItem = (mediaInfo?: UploadMediaInfo): UploadItem => ({
  id: 'test-id',
  file: new File(['fake'], 'voice-message.ogg', { type: 'audio/ogg' }),
  originalFile: new File(['fake'], 'voice-message.ogg', { type: 'audio/ogg' }),
  metadata: { markedAsSpoiler: false },
  mediaInfo,
  encryptionInfo: undefined,
});

beforeEach(() => {
  probeMock.mockReset();
  probeMock.mockResolvedValue(undefined);
});

describe('getAudioMsgContent', () => {
  it('writes only mimetype and size when no mediaInfo and probe returns undefined', async () => {
    const content = await getAudioMsgContent(makeItem(), MXC);

    expect(content.msgtype).toBe(MsgType.Audio);
    expect(content.info).toEqual({ mimetype: 'audio/ogg', size: 4 });
    expect(content['org.matrix.msc1767.audio']).toBeUndefined();
    expect(content['org.matrix.msc3245.voice']).toBeUndefined();
    expect(content.url).toBe(MXC);
  });

  it('writes info.duration and the MSC1767 audio block when durationMs is provided in mediaInfo', async () => {
    const content = await getAudioMsgContent(makeItem({ audio: { durationMs: 5240 } }), MXC);

    expect(content.info?.duration).toBe(5240);
    expect(content['org.matrix.msc1767.audio']).toEqual({ duration: 5240 });
    expect(content['org.matrix.msc3245.voice']).toBeUndefined();
  });

  it('adds the MSC3245 voice marker when isVoiceMessage is true', async () => {
    const content = await getAudioMsgContent(
      makeItem({ audio: { durationMs: 5240, isVoiceMessage: true } }),
      MXC
    );

    expect(content.info?.duration).toBe(5240);
    expect(content['org.matrix.msc1767.audio']).toEqual({ duration: 5240 });
    expect(content['org.matrix.msc3245.voice']).toEqual({});
  });

  it('writes the voice marker without duration when isVoiceMessage is true but probe returns undefined', async () => {
    const content = await getAudioMsgContent(makeItem({ audio: { isVoiceMessage: true } }), MXC);

    expect(content.info?.duration).toBeUndefined();
    expect(content['org.matrix.msc1767.audio']).toBeUndefined();
    expect(content['org.matrix.msc3245.voice']).toEqual({});
  });

  it('falls back to probing originalFile when mediaInfo has no durationMs', async () => {
    probeMock.mockResolvedValue(3000);
    const item = makeItem();

    const content = await getAudioMsgContent(item, MXC);

    expect(probeMock).toHaveBeenCalledWith(item.originalFile);
    expect(content.info?.duration).toBe(3000);
    expect(content['org.matrix.msc1767.audio']).toEqual({ duration: 3000 });
  });

  it('falls back to probing when durationMs is Infinity', async () => {
    probeMock.mockResolvedValue(2500);
    const content = await getAudioMsgContent(
      makeItem({ audio: { durationMs: Infinity, isVoiceMessage: true } }),
      MXC
    );

    expect(probeMock).toHaveBeenCalled();
    expect(content.info?.duration).toBe(2500);
    expect(content['org.matrix.msc3245.voice']).toEqual({});
  });

  it('falls back to probing when durationMs is NaN', async () => {
    probeMock.mockResolvedValue(1500);
    const content = await getAudioMsgContent(makeItem({ audio: { durationMs: NaN } }), MXC);

    expect(probeMock).toHaveBeenCalled();
    expect(content.info?.duration).toBe(1500);
  });

  it('skips probing when mediaInfo provides a finite durationMs', async () => {
    probeMock.mockResolvedValue(9999);
    const content = await getAudioMsgContent(makeItem({ audio: { durationMs: 5240 } }), MXC);

    expect(probeMock).not.toHaveBeenCalled();
    expect(content.info?.duration).toBe(5240);
  });

  it('omits duration fields when the probe also returns undefined', async () => {
    probeMock.mockResolvedValue(undefined);
    const content = await getAudioMsgContent(makeItem(), MXC);

    expect(content.info?.duration).toBeUndefined();
    expect(content['org.matrix.msc1767.audio']).toBeUndefined();
  });

  it('rounds non-integer durationMs values to integers', async () => {
    const content = await getAudioMsgContent(makeItem({ audio: { durationMs: 5240.7 } }), MXC);

    expect(content.info?.duration).toBe(5241);
    expect(content['org.matrix.msc1767.audio']).toEqual({ duration: 5241 });
  });

  it('clamps negative durationMs to 0', async () => {
    const content = await getAudioMsgContent(makeItem({ audio: { durationMs: -100 } }), MXC);

    expect(content.info?.duration).toBe(0);
    expect(content['org.matrix.msc1767.audio']).toEqual({ duration: 0 });
  });
});
