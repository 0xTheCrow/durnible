export type TimelineScrollTraceEntry = {
  at: number;
  epochMs: number;
  event: string;
  detail?: Record<string, unknown>;
  count?: number;
};

const MAX_TRACE_ENTRIES = 500;

export const TRACE_COALESCE_WINDOW_MS = 250;

const COALESCED_TRACE_EVENTS = new Set([
  'maintainPosition:apply',
  'apply:scrollToLatestMessageBottom',
  'apply:anchor-missing',
  'userInput',
  'scroll',
]);

const traceEntries: TimelineScrollTraceEntry[] = [];

export const traceTimelineScroll = (event: string, detail?: Record<string, unknown>): void => {
  const epochMs = Date.now();
  const lastEntry = traceEntries[traceEntries.length - 1];
  if (
    lastEntry &&
    lastEntry.event === event &&
    COALESCED_TRACE_EVENTS.has(event) &&
    epochMs - lastEntry.epochMs < TRACE_COALESCE_WINDOW_MS
  ) {
    lastEntry.at = Math.round(performance.now());
    lastEntry.epochMs = epochMs;
    lastEntry.detail = detail;
    lastEntry.count = (lastEntry.count ?? 1) + 1;
    return;
  }
  traceEntries.push({ at: Math.round(performance.now()), epochMs, event, detail });
  if (traceEntries.length > MAX_TRACE_ENTRIES) traceEntries.shift();
};

const formatTraceEntry = (entry: TimelineScrollTraceEntry): string => {
  const time = new Date(entry.epochMs);
  const timeText = `${time.toTimeString().slice(0, 8)}.${String(time.getMilliseconds()).padStart(
    3,
    '0'
  )}`;
  const detailText = entry.detail ? ` ${JSON.stringify(entry.detail)}` : '';
  const countText = entry.count ? ` ×${entry.count}` : '';
  return `${timeText} ${entry.event}${detailText}${countText}`;
};

if (typeof window !== 'undefined') {
  const globalWindow = window as unknown as {
    __timelineScrollTrace: () => TimelineScrollTraceEntry[];
    __timelineScrollTraceText: (lastSeconds?: number) => string;
    __timelineScrollTraceClear: () => void;
  };
  globalWindow.__timelineScrollTrace = () => [...traceEntries];
  globalWindow.__timelineScrollTraceText = (lastSeconds = 300) => {
    const oldestEpochMs = Date.now() - lastSeconds * 1000;
    return traceEntries
      .filter((entry) => entry.epochMs >= oldestEpochMs)
      .map(formatTraceEntry)
      .join('\n');
  };
  globalWindow.__timelineScrollTraceClear = () => {
    traceEntries.length = 0;
  };
  window.addEventListener('focus', () => traceTimelineScroll('window:focus'));
  window.addEventListener('blur', () => traceTimelineScroll('window:blur'));
  /* eslint-disable-next-line no-console */
  console.info(
    [
      'Timeline scroll trace active. Reproduce the issue, then copy the trace:',
      '',
      'copy(__timelineScrollTraceText())',
      '',
      'Takes an optional seconds argument (default 300). Other commands:',
      '',
      '__timelineScrollTraceClear()',
      '__timelineScrollTrace()',
      '',
      'Clear empties the buffer before a repro; the bare call returns raw entries.',
    ].join('\n')
  );
}
