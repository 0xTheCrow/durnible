export type TimelineScrollTraceEntry = {
  at: number;
  event: string;
  detail?: Record<string, unknown>;
};

const MAX_TRACE_ENTRIES = 300;

const traceEntries: TimelineScrollTraceEntry[] = [];

export const traceTimelineScroll = (event: string, detail?: Record<string, unknown>): void => {
  traceEntries.push({ at: Math.round(performance.now()), event, detail });
  if (traceEntries.length > MAX_TRACE_ENTRIES) traceEntries.shift();
};

if (typeof window !== 'undefined') {
  (
    window as unknown as { __timelineScrollTrace: () => TimelineScrollTraceEntry[] }
  ).__timelineScrollTrace = () => [...traceEntries];
}
