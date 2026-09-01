import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'durnible_app_update_snooze';

const SNOOZE_DURATION_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

type AppUpdateSnooze = {
  promptKey: string;
  untilTimestamp: number;
};

const readSnooze = (): AppUpdateSnooze | undefined => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<AppUpdateSnooze>;
    if (typeof parsed.promptKey !== 'string') return undefined;
    if (typeof parsed.untilTimestamp !== 'number' || !Number.isFinite(parsed.untilTimestamp)) {
      return undefined;
    }
    return { promptKey: parsed.promptKey, untilTimestamp: parsed.untilTimestamp };
  } catch {
    return undefined;
  }
};

const writeSnooze = (snooze: AppUpdateSnooze): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snooze));
  } catch {
    // Storage is unavailable; the prompt stays hidden for this session only.
  }
};

export const useAppUpdateSnooze = (
  promptKey: string | undefined
): { isSnoozed: boolean; snoozePrompt: () => void } => {
  const [snooze, setSnooze] = useState(readSnooze);

  useEffect(() => {
    if (!snooze) return undefined;
    const remainingMilliseconds = snooze.untilTimestamp - Date.now();
    if (remainingMilliseconds <= 0) {
      setSnooze(undefined);
      return undefined;
    }
    const timeoutId = setTimeout(() => setSnooze(undefined), remainingMilliseconds);
    return () => clearTimeout(timeoutId);
  }, [snooze]);

  const snoozePrompt = useCallback(() => {
    if (!promptKey) return;
    const nextSnooze: AppUpdateSnooze = {
      promptKey,
      untilTimestamp: Date.now() + SNOOZE_DURATION_MILLISECONDS,
    };
    writeSnooze(nextSnooze);
    setSnooze(nextSnooze);
  }, [promptKey]);

  const isSnoozed =
    !!promptKey && !!snooze && snooze.promptKey === promptKey && snooze.untilTimestamp > Date.now();

  return { isSnoozed, snoozePrompt };
};
