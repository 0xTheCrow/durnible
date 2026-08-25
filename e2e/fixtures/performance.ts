import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CDPSession, Page } from '@playwright/test';

export const PERFORMANCE_RESULTS_DIR = path.resolve('performance-results');

type ProfileCallFrame = {
  functionName: string;
  url: string;
  lineNumber: number;
};

type ProfileNode = {
  id: number;
  callFrame: ProfileCallFrame;
  children?: number[];
};

export type CpuProfile = {
  nodes: ProfileNode[];
  startTime: number;
  endTime: number;
  samples?: number[];
  timeDeltas?: number[];
};

export type PerformanceSession = {
  client: CDPSession;
  start: () => Promise<void>;
  stop: () => Promise<CpuProfile>;
  detach: () => Promise<void>;
};

type PerformanceSessionOptions = {
  cpuThrottlingRate?: number;
  samplingIntervalMicroseconds?: number;
};

export const createPerformanceSession = async (
  page: Page,
  { cpuThrottlingRate = 1, samplingIntervalMicroseconds = 100 }: PerformanceSessionOptions = {}
): Promise<PerformanceSession> => {
  const client: CDPSession = await page.context().newCDPSession(page);
  await client.send('Profiler.enable');
  await client.send('Profiler.setSamplingInterval', { interval: samplingIntervalMicroseconds });
  if (cpuThrottlingRate > 1) {
    await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottlingRate });
  }

  return {
    client,
    start: async () => {
      await client.send('Profiler.start');
    },
    stop: async () => {
      const { profile } = (await client.send('Profiler.stop')) as { profile: CpuProfile };
      return profile;
    },
    detach: async () => {
      await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await client.detach();
    },
  };
};

type TraceEvent = {
  name: string;
  ph: string;
  ts: number;
  dur?: number;
};

export type TraceEventSummary = {
  name: string;
  totalMs: number;
  count: number;
};

export type RendererTiming = {
  byEvent: TraceEventSummary[];
  styleMs: number;
  layoutMs: number;
  paintMs: number;
};

const RENDERER_TRACE_CATEGORIES = ['devtools.timeline'];

export type RendererTrace = {
  stop: () => Promise<RendererTiming>;
};

export const startRendererTrace = async (client: CDPSession): Promise<RendererTrace> => {
  const events: TraceEvent[] = [];
  const collect = (payload: { value?: TraceEvent[] }) => {
    if (payload.value) events.push(...payload.value);
  };
  client.on('Tracing.dataCollected', collect);
  await client.send('Tracing.start', {
    traceConfig: { includedCategories: RENDERER_TRACE_CATEGORIES },
    transferMode: 'ReportEvents',
  });

  return {
    stop: async () => {
      const tracingComplete = new Promise<void>((resolve) => {
        client.once('Tracing.tracingComplete', () => resolve());
      });
      await client.send('Tracing.end');
      await tracingComplete;
      client.off('Tracing.dataCollected', collect);
      return summarizeRendererTrace(events);
    },
  };
};

const totalMsForEvent = (byName: Map<string, TraceEventSummary>, name: string): number =>
  byName.get(name)?.totalMs ?? 0;

const summarizeRendererTrace = (events: TraceEvent[]): RendererTiming => {
  const byName = new Map<string, TraceEventSummary>();
  events.forEach((event) => {
    if (event.ph !== 'X' || event.dur === undefined) return;
    const existing = byName.get(event.name);
    if (existing) {
      existing.totalMs += event.dur / 1000;
      existing.count += 1;
      return;
    }
    byName.set(event.name, { name: event.name, totalMs: event.dur / 1000, count: 1 });
  });

  return {
    byEvent: [...byName.values()].sort((a, b) => b.totalMs - a.totalMs),
    styleMs: totalMsForEvent(byName, 'UpdateLayoutTree'),
    layoutMs: totalMsForEvent(byName, 'Layout'),
    paintMs: totalMsForEvent(byName, 'Paint') + totalMsForEvent(byName, 'Commit'),
  };
};

export type ProfileEntry = {
  label: string;
  selfMs: number;
  sharePercent: number;
};

export type ProfileSummary = {
  sampledMs: number;
  idleMs: number;
  activeMs: number;
  unattributedMs: number;
  byFunction: ProfileEntry[];
  bySourceFile: ProfileEntry[];
  inclusiveMsByFunctionName: Map<string, number>;
};

const ENGINE_PSEUDO_FRAMES = new Set(['(program)', '(idle)', '(root)']);

const shortenUrl = (url: string): string => {
  if (!url) return '(native)';
  const withoutQuery = url.split('?')[0];
  const sourceIndex = withoutQuery.indexOf('/src/');
  if (sourceIndex !== -1) return withoutQuery.slice(sourceIndex + 1);
  const modulesIndex = withoutQuery.indexOf('/node_modules/');
  if (modulesIndex !== -1) return withoutQuery.slice(modulesIndex + 1);
  return withoutQuery.replace(/^https?:\/\/[^/]+/, '') || withoutQuery;
};

const rankEntries = (selfMsByLabel: Map<string, number>, sampledMs: number): ProfileEntry[] =>
  [...selfMsByLabel.entries()]
    .map(([label, selfMs]) => ({
      label,
      selfMs,
      sharePercent: sampledMs > 0 ? (selfMs / sampledMs) * 100 : 0,
    }))
    .sort((a, b) => b.selfMs - a.selfMs);

export const summarizeProfile = (profile: CpuProfile): ProfileSummary => {
  const { nodes, samples = [], timeDeltas = [] } = profile;
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  const parentIdByNodeId = new Map<number, number>();
  nodes.forEach((node) => {
    node.children?.forEach((childId) => parentIdByNodeId.set(childId, node.id));
  });

  const selfMsByFunction = new Map<string, number>();
  const selfMsBySourceFile = new Map<string, number>();
  const inclusiveMsByFunctionName = new Map<string, number>();
  let sampledMs = 0;
  let idleMs = 0;
  let unattributedMs = 0;

  samples.forEach((nodeId, sampleIndex) => {
    const node = nodesById.get(nodeId);
    if (!node) return;
    const elapsedMs = (timeDeltas[sampleIndex] ?? 0) / 1000;
    if (elapsedMs <= 0) return;

    const sourceFile = shortenUrl(node.callFrame.url);
    const functionName = node.callFrame.functionName || '(anonymous)';

    sampledMs += elapsedMs;
    if (functionName === '(idle)') {
      idleMs += elapsedMs;
      return;
    }
    if (ENGINE_PSEUDO_FRAMES.has(functionName)) {
      unattributedMs += elapsedMs;
      return;
    }
    const functionLabel = `${functionName} — ${sourceFile}`;
    selfMsByFunction.set(functionLabel, (selfMsByFunction.get(functionLabel) ?? 0) + elapsedMs);
    selfMsBySourceFile.set(sourceFile, (selfMsBySourceFile.get(sourceFile) ?? 0) + elapsedMs);

    const seenOnStack = new Set<string>();
    for (let ancestorId: number | undefined = nodeId; ancestorId !== undefined; ) {
      const ancestor = nodesById.get(ancestorId);
      if (!ancestor) break;
      const ancestorName = ancestor.callFrame.functionName;
      if (ancestorName && !seenOnStack.has(ancestorName)) {
        seenOnStack.add(ancestorName);
        inclusiveMsByFunctionName.set(
          ancestorName,
          (inclusiveMsByFunctionName.get(ancestorName) ?? 0) + elapsedMs
        );
      }
      ancestorId = parentIdByNodeId.get(ancestorId);
    }
  });

  const activeMs = sampledMs - idleMs;
  const attributedMs = activeMs - unattributedMs;

  return {
    sampledMs,
    idleMs,
    activeMs,
    unattributedMs,
    byFunction: rankEntries(selfMsByFunction, attributedMs),
    bySourceFile: rankEntries(selfMsBySourceFile, attributedMs),
    inclusiveMsByFunctionName,
  };
};

export const saveCpuProfile = async (profile: CpuProfile, fileName: string): Promise<string> => {
  await mkdir(PERFORMANCE_RESULTS_DIR, { recursive: true });
  const filePath = path.join(PERFORMANCE_RESULTS_DIR, `${fileName}.cpuprofile`);
  await writeFile(filePath, JSON.stringify(profile));
  return filePath;
};

export const saveReport = async (fileName: string, contents: string): Promise<string> => {
  await mkdir(PERFORMANCE_RESULTS_DIR, { recursive: true });
  const filePath = path.join(PERFORMANCE_RESULTS_DIR, fileName);
  await writeFile(filePath, contents);
  return filePath;
};

export type KeystrokeTiming = {
  keydownBlockMs: number[];
  inputBlockMs: number[];
  keyupBlockMs: number[];
  frameMs: number[];
  compositionBlockMs: number[];
  compositionFrameMs: number[];
  longTaskMs: number[];
};

declare global {
  interface Window {
    __keystrokeTiming?: KeystrokeTiming;
  }
}

export const installKeystrokeTiming = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const timing: KeystrokeTiming = {
      keydownBlockMs: [],
      inputBlockMs: [],
      keyupBlockMs: [],
      frameMs: [],
      compositionBlockMs: [],
      compositionFrameMs: [],
      longTaskMs: [],
    };
    window.__keystrokeTiming = timing;

    const scheduleAfterCurrentTask = (onTaskDrained: () => void) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = onTaskDrained;
      channel.port2.postMessage(null);
    };

    document.addEventListener(
      'keydown',
      () => {
        const startedAt = performance.now();
        scheduleAfterCurrentTask(() => timing.keydownBlockMs.push(performance.now() - startedAt));
        requestAnimationFrame(() => {
          setTimeout(() => timing.frameMs.push(performance.now() - startedAt), 0);
        });
      },
      true
    );

    document.addEventListener(
      'input',
      () => {
        const startedAt = performance.now();
        scheduleAfterCurrentTask(() => timing.inputBlockMs.push(performance.now() - startedAt));
      },
      true
    );

    document.addEventListener(
      'keyup',
      () => {
        const startedAt = performance.now();
        scheduleAfterCurrentTask(() => timing.keyupBlockMs.push(performance.now() - startedAt));
      },
      true
    );

    document.addEventListener(
      'compositionupdate',
      () => {
        const startedAt = performance.now();
        scheduleAfterCurrentTask(() =>
          timing.compositionBlockMs.push(performance.now() - startedAt)
        );
        requestAnimationFrame(() => {
          setTimeout(() => timing.compositionFrameMs.push(performance.now() - startedAt), 0);
        });
      },
      true
    );

    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => timing.longTaskMs.push(entry.duration));
    }).observe({ type: 'longtask', buffered: false });
  });

export const collectKeystrokeTiming = async (page: Page): Promise<KeystrokeTiming> =>
  page.evaluate(
    () =>
      window.__keystrokeTiming ?? {
        keydownBlockMs: [],
        inputBlockMs: [],
        keyupBlockMs: [],
        frameMs: [],
        compositionBlockMs: [],
        compositionFrameMs: [],
        longTaskMs: [],
      }
  );

export type SampleStats = {
  count: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
};

const percentile = (sortedValues: number[], fraction: number): number => {
  if (sortedValues.length === 0) return 0;
  const rank = Math.min(sortedValues.length - 1, Math.floor(fraction * sortedValues.length));
  return sortedValues[rank];
};

export const summarizeSamples = (values: number[]): SampleStats => {
  if (values.length === 0) return { count: 0, meanMs: 0, p50Ms: 0, p95Ms: 0, maxMs: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    count: sorted.length,
    meanMs: total / sorted.length,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted[sorted.length - 1],
  };
};

export const formatMs = (value: number): string => value.toFixed(1);
