import { describe, it, expect } from 'vitest';
import {
  type CallUserVolumePreference,
  type CallVolumePreferences,
  getCallScreensharePlaybackVolumeLevel,
} from './callVolumePreferences';

const USER_ID = '@alice:example.org';
const MASTER_VOLUME_LEVEL = 0.5;
const SCREENSHARE_VOLUME_LEVEL = 0.4;

const createPreferences = (
  userPreference: Pick<CallUserVolumePreference, 'isMuted' | 'isScreenshareMuted'>
): CallVolumePreferences => ({
  masterVolumeLevel: MASTER_VOLUME_LEVEL,
  userPreferences: {
    [USER_ID]: {
      volumeLevel: 1,
      screenshareVolumeLevel: SCREENSHARE_VOLUME_LEVEL,
      updatedAt: 0,
      ...userPreference,
    },
  },
});

describe('getCallScreensharePlaybackVolumeLevel', () => {
  it('keeps screenshare audio playing when only the voice is muted', () => {
    const preferences = createPreferences({ isMuted: true, isScreenshareMuted: false });

    expect(getCallScreensharePlaybackVolumeLevel(preferences, USER_ID)).toBe(
      MASTER_VOLUME_LEVEL * SCREENSHARE_VOLUME_LEVEL
    );
  });

  it('silences screenshare audio when the screen is muted', () => {
    const preferences = createPreferences({ isMuted: false, isScreenshareMuted: true });

    expect(getCallScreensharePlaybackVolumeLevel(preferences, USER_ID)).toBe(0);
  });
});
