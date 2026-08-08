import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';
import type { CallVolumePreferences } from '../callVolumePreferences';
import { callVolumePreferencesAtom, getCallUserVolumePreference } from '../callVolumePreferences';

export const useCallUserIsMuted = (userId: string | undefined): boolean => {
  const selector = useMemo(
    () => (preferences: CallVolumePreferences) =>
      getCallUserVolumePreference(preferences, userId).isMuted,
    [userId]
  );

  return useAtomValue(selectAtom(callVolumePreferencesAtom, selector));
};
