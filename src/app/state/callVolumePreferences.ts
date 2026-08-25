import { atom } from 'jotai';

const STORAGE_KEY = 'durnible_call_volume_preferences';

export const CALL_VOLUME_LEVEL_MIN = 0;
export const CALL_VOLUME_LEVEL_MAX = 1;
export const CALL_VOLUME_LEVEL_DEFAULT = 1;
export const CALL_VOLUME_USER_PREFERENCE_LIMIT = 500;

export type CallUserVolumePreference = {
  volumeLevel: number;
  isMuted: boolean;
  screenshareVolumeLevel: number;
  isScreenshareMuted: boolean;
  updatedAt: number;
};

export type CallVolumePreferences = {
  masterVolumeLevel: number;
  userPreferences: Record<string, CallUserVolumePreference>;
};

const DEFAULT_USER_PREFERENCE: CallUserVolumePreference = {
  volumeLevel: CALL_VOLUME_LEVEL_DEFAULT,
  isMuted: false,
  screenshareVolumeLevel: CALL_VOLUME_LEVEL_DEFAULT,
  isScreenshareMuted: false,
  updatedAt: 0,
};

const clampVolumeLevel = (volumeLevel: number): number =>
  Math.min(CALL_VOLUME_LEVEL_MAX, Math.max(CALL_VOLUME_LEVEL_MIN, volumeLevel));

const checkIsDefaultUserPreference = (preference: CallUserVolumePreference): boolean =>
  preference.volumeLevel === CALL_VOLUME_LEVEL_DEFAULT &&
  !preference.isMuted &&
  preference.screenshareVolumeLevel === CALL_VOLUME_LEVEL_DEFAULT &&
  !preference.isScreenshareMuted;

const parseVolumeLevel = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return clampVolumeLevel(value);
};

const parseUpdatedAt = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return value;
};

const dropPreferencesOverLimit = (
  userPreferences: Record<string, CallUserVolumePreference>
): Record<string, CallUserVolumePreference> => {
  const entries = Object.entries(userPreferences);
  if (entries.length <= CALL_VOLUME_USER_PREFERENCE_LIMIT) return userPreferences;
  return Object.fromEntries(
    entries
      .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
      .slice(0, CALL_VOLUME_USER_PREFERENCE_LIMIT)
  );
};

const loadFromStorage = (): CallVolumePreferences => {
  const preferences: CallVolumePreferences = {
    masterVolumeLevel: CALL_VOLUME_LEVEL_DEFAULT,
    userPreferences: {},
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return preferences;
    const parsed = JSON.parse(raw) as Partial<CallVolumePreferences>;

    preferences.masterVolumeLevel =
      parseVolumeLevel(parsed.masterVolumeLevel) ?? CALL_VOLUME_LEVEL_DEFAULT;

    Object.entries(parsed.userPreferences ?? {}).forEach(([userId, userPreference]) => {
      if (!userPreference) return;
      const preference: CallUserVolumePreference = {
        volumeLevel: parseVolumeLevel(userPreference.volumeLevel) ?? CALL_VOLUME_LEVEL_DEFAULT,
        isMuted: userPreference.isMuted === true,
        screenshareVolumeLevel:
          parseVolumeLevel(userPreference.screenshareVolumeLevel) ?? CALL_VOLUME_LEVEL_DEFAULT,
        isScreenshareMuted: userPreference.isScreenshareMuted === true,
        updatedAt: parseUpdatedAt(userPreference.updatedAt),
      };
      if (checkIsDefaultUserPreference(preference)) return;
      preferences.userPreferences[userId] = preference;
    });

    preferences.userPreferences = dropPreferencesOverLimit(preferences.userPreferences);
    return preferences;
  } catch {
    return preferences;
  }
};

const saveToStorage = (preferences: CallVolumePreferences): void => {
  const serialized = JSON.stringify(preferences);
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Storage is unavailable; a volume preference is not worth interrupting the call for.
  }
};

const baseCallVolumePreferences = atom<CallVolumePreferences>(loadFromStorage());

export const callVolumePreferencesAtom = atom((get) => get(baseCallVolumePreferences));

export const setCallMasterVolumeLevelAtom = atom<
  null,
  [{ volumeLevel: number; isCommit: boolean }],
  undefined
>(null, (get, set, { volumeLevel, isCommit }) => {
  const preferences: CallVolumePreferences = {
    ...get(baseCallVolumePreferences),
    masterVolumeLevel: clampVolumeLevel(volumeLevel),
  };

  set(baseCallVolumePreferences, preferences);
  if (isCommit) saveToStorage(preferences);
});

export const setCallUserVolumePreferenceAtom = atom<
  null,
  [{ userId: string; preference: Partial<CallUserVolumePreference>; isCommit: boolean }],
  undefined
>(null, (get, set, { userId, preference, isCommit }) => {
  const currentPreferences = get(baseCallVolumePreferences);
  const userPreferences = { ...currentPreferences.userPreferences };
  const nextPreference: CallUserVolumePreference = {
    ...(userPreferences[userId] ?? DEFAULT_USER_PREFERENCE),
    ...preference,
  };
  nextPreference.volumeLevel = clampVolumeLevel(nextPreference.volumeLevel);
  nextPreference.screenshareVolumeLevel = clampVolumeLevel(nextPreference.screenshareVolumeLevel);
  nextPreference.updatedAt = Date.now();

  if (checkIsDefaultUserPreference(nextPreference)) {
    delete userPreferences[userId];
  } else {
    userPreferences[userId] = nextPreference;
  }

  const preferences: CallVolumePreferences = {
    ...currentPreferences,
    userPreferences: dropPreferencesOverLimit(userPreferences),
  };
  set(baseCallVolumePreferences, preferences);
  if (isCommit) saveToStorage(preferences);
});

export const getCallUserVolumePreference = (
  preferences: CallVolumePreferences,
  userId: string | undefined
): CallUserVolumePreference => {
  if (!userId) return DEFAULT_USER_PREFERENCE;
  return preferences.userPreferences[userId] ?? DEFAULT_USER_PREFERENCE;
};

export const getCallUserPlaybackVolumeLevel = (
  preferences: CallVolumePreferences,
  userId: string | undefined
): number => {
  const userPreference = getCallUserVolumePreference(preferences, userId);
  if (userPreference.isMuted) return 0;
  return preferences.masterVolumeLevel * userPreference.volumeLevel;
};

export const getCallScreensharePlaybackVolumeLevel = (
  preferences: CallVolumePreferences,
  userId: string | undefined
): number => {
  const userPreference = getCallUserVolumePreference(preferences, userId);
  if (userPreference.isMuted || userPreference.isScreenshareMuted) return 0;
  return preferences.masterVolumeLevel * userPreference.screenshareVolumeLevel;
};
