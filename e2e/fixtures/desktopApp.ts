import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron as electron } from '@playwright/test';
import type { CDPSession, ElectronApplication, Page } from '@playwright/test';

const DESKTOP_MAIN_PATH = path.resolve('platform/desktop/dist/main.cjs');
const WINDOW_WIDTH = 1280;
const WINDOW_HEIGHT = 800;

export const DESKTOP_APP_ORIGIN = 'app://durnible';

export type DesktopApp = {
  electronApp: ElectronApplication;
  window: Page;
  close: () => Promise<void>;
};

export const launchDesktopApp = async (): Promise<DesktopApp> => {
  const userDataDirectory = await mkdtemp(path.join(tmpdir(), 'durnible-performance-'));
  const electronApp = await electron.launch({
    args: [DESKTOP_MAIN_PATH, `--user-data-dir=${userDataDirectory}`],
  });
  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await electronApp.evaluate(
    ({ BrowserWindow }, { width, height }) => {
      const [mainWindow] = BrowserWindow.getAllWindows();
      mainWindow?.setContentSize(width, height);
    },
    { width: WINDOW_WIDTH, height: WINDOW_HEIGHT }
  );

  return {
    electronApp,
    window,
    close: async () => {
      await electronApp.close();
      await rm(userDataDirectory, { recursive: true, force: true });
    },
  };
};

type ElectronProcessMetric = {
  type: string;
  pid: number;
  serviceName?: string;
  cpu: { cumulativeCPUUsage?: number };
  memory: { workingSetSize: number };
};

type MemoryKilobytes = {
  workingSetKilobytes: number;
  proportionalSetKilobytes: number;
  privateKilobytes: number;
};

type ProcessResourceSample = MemoryKilobytes & {
  processLabel: string;
  pid: number;
  cumulativeCpuSeconds: number;
};

export type ProcessResourceUsage = {
  processLabel: string;
  cpuSeconds: number;
  cpuCores: number;
  meanWorkingSetMegabytes: number;
  peakWorkingSetMegabytes: number;
  meanProportionalSetMegabytes: number;
  peakProportionalSetMegabytes: number;
  meanPrivateMegabytes: number;
  peakPrivateMegabytes: number;
};

export type ResourceUsage = {
  wallClockSeconds: number;
  sampleCount: number;
  byProcess: ProcessResourceUsage[];
  totalCpuSeconds: number;
  totalCpuCores: number;
  meanTotalProportionalSetMegabytes: number;
  peakTotalProportionalSetMegabytes: number;
  meanTotalPrivateMegabytes: number;
  peakTotalPrivateMegabytes: number;
};

export type ResourceSampler = {
  stop: () => Promise<ResourceUsage>;
};

const KILOBYTES_PER_MEGABYTE = 1024;
const EXITED_PROCESS_ERROR_CODES = new Set(['ENOENT', 'ESRCH']);
const EMPTY_MEMORY: MemoryKilobytes = {
  workingSetKilobytes: 0,
  proportionalSetKilobytes: 0,
  privateKilobytes: 0,
};

const checkIsExitedProcessError = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && EXITED_PROCESS_ERROR_CODES.has(String(error.code));

const readSmapsRollupKilobytes = (smapsRollup: string, fieldName: string): number => {
  const match = new RegExp(`^${fieldName}:\\s+(\\d+) kB$`, 'm').exec(smapsRollup);
  if (!match) throw new Error(`smaps_rollup has no ${fieldName} line`);
  return Number(match[1]);
};

const readProcessMemory = async (
  pid: number
): Promise<Omit<MemoryKilobytes, 'workingSetKilobytes'> | undefined> => {
  let smapsRollup: string;
  try {
    smapsRollup = await readFile(`/proc/${pid}/smaps_rollup`, 'utf8');
  } catch (error) {
    if (checkIsExitedProcessError(error)) return undefined;
    throw error;
  }
  return {
    proportionalSetKilobytes: readSmapsRollupKilobytes(smapsRollup, 'Pss'),
    privateKilobytes:
      readSmapsRollupKilobytes(smapsRollup, 'Private_Clean') +
      readSmapsRollupKilobytes(smapsRollup, 'Private_Dirty'),
  };
};

const sampleProcessMetrics = async (
  electronApp: ElectronApplication
): Promise<ProcessResourceSample[]> => {
  const metrics = await electronApp.evaluate(({ app }) =>
    (app.getAppMetrics() as ElectronProcessMetric[]).map((metric) => ({
      processLabel: metric.serviceName ? `${metric.type} (${metric.serviceName})` : metric.type,
      pid: metric.pid,
      cumulativeCpuSeconds: metric.cpu.cumulativeCPUUsage ?? 0,
      workingSetKilobytes: metric.memory.workingSetSize,
    }))
  );
  const samples = await Promise.all(
    metrics.map(async (metric) => {
      const memory = await readProcessMemory(metric.pid);
      return memory ? { ...metric, ...memory } : undefined;
    })
  );
  return samples.filter((sample): sample is ProcessResourceSample => sample !== undefined);
};

const addMemory = (sum: MemoryKilobytes, sample: MemoryKilobytes): MemoryKilobytes => ({
  workingSetKilobytes: sum.workingSetKilobytes + sample.workingSetKilobytes,
  proportionalSetKilobytes: sum.proportionalSetKilobytes + sample.proportionalSetKilobytes,
  privateKilobytes: sum.privateKilobytes + sample.privateKilobytes,
});

const meanMegabytes = (kilobytes: number[]): number =>
  kilobytes.reduce((sum, value) => sum + value, 0) / kilobytes.length / KILOBYTES_PER_MEGABYTE;

const peakMegabytes = (kilobytes: number[]): number =>
  Math.max(...kilobytes) / KILOBYTES_PER_MEGABYTE;

const summarizeResourceSamples = (
  sampleRounds: ProcessResourceSample[][],
  wallClockSeconds: number
): ResourceUsage => {
  const firstByPid = new Map<number, ProcessResourceSample>();
  const lastByPid = new Map<number, ProcessResourceSample>();
  const memoryRoundsByLabel = new Map<string, MemoryKilobytes[]>();

  sampleRounds.forEach((round) => {
    const roundMemoryByLabel = new Map<string, MemoryKilobytes>();
    round.forEach((sample) => {
      if (!firstByPid.has(sample.pid)) firstByPid.set(sample.pid, sample);
      lastByPid.set(sample.pid, sample);
      roundMemoryByLabel.set(
        sample.processLabel,
        addMemory(roundMemoryByLabel.get(sample.processLabel) ?? EMPTY_MEMORY, sample)
      );
    });
    roundMemoryByLabel.forEach((memory, processLabel) => {
      const existing = memoryRoundsByLabel.get(processLabel);
      if (existing) existing.push(memory);
      else memoryRoundsByLabel.set(processLabel, [memory]);
    });
  });

  const cpuSecondsByLabel = new Map<string, number>();
  firstByPid.forEach((firstSample, pid) => {
    const lastSample = lastByPid.get(pid);
    if (!lastSample) return;
    const cpuSeconds = lastSample.cumulativeCpuSeconds - firstSample.cumulativeCpuSeconds;
    cpuSecondsByLabel.set(
      firstSample.processLabel,
      (cpuSecondsByLabel.get(firstSample.processLabel) ?? 0) + cpuSeconds
    );
  });

  const byProcess = [...memoryRoundsByLabel.entries()]
    .map(([processLabel, memoryRounds]) => {
      const cpuSeconds = cpuSecondsByLabel.get(processLabel) ?? 0;
      const workingSetKilobytes = memoryRounds.map((memory) => memory.workingSetKilobytes);
      const proportionalSetKilobytes = memoryRounds.map(
        (memory) => memory.proportionalSetKilobytes
      );
      const privateKilobytes = memoryRounds.map((memory) => memory.privateKilobytes);
      return {
        processLabel,
        cpuSeconds,
        cpuCores: wallClockSeconds > 0 ? cpuSeconds / wallClockSeconds : 0,
        meanWorkingSetMegabytes: meanMegabytes(workingSetKilobytes),
        peakWorkingSetMegabytes: peakMegabytes(workingSetKilobytes),
        meanProportionalSetMegabytes: meanMegabytes(proportionalSetKilobytes),
        peakProportionalSetMegabytes: peakMegabytes(proportionalSetKilobytes),
        meanPrivateMegabytes: meanMegabytes(privateKilobytes),
        peakPrivateMegabytes: peakMegabytes(privateKilobytes),
      };
    })
    .sort((a, b) => b.cpuSeconds - a.cpuSeconds);

  const totalMemoryPerRound = sampleRounds.map((round) => round.reduce(addMemory, EMPTY_MEMORY));
  const totalProportionalSetKilobytes = totalMemoryPerRound.map(
    (memory) => memory.proportionalSetKilobytes
  );
  const totalPrivateKilobytes = totalMemoryPerRound.map((memory) => memory.privateKilobytes);
  const totalCpuSeconds = [...cpuSecondsByLabel.values()].reduce((sum, value) => sum + value, 0);

  return {
    wallClockSeconds,
    sampleCount: sampleRounds.length,
    byProcess,
    totalCpuSeconds,
    totalCpuCores: wallClockSeconds > 0 ? totalCpuSeconds / wallClockSeconds : 0,
    meanTotalProportionalSetMegabytes: meanMegabytes(totalProportionalSetKilobytes),
    peakTotalProportionalSetMegabytes: peakMegabytes(totalProportionalSetKilobytes),
    meanTotalPrivateMegabytes: meanMegabytes(totalPrivateKilobytes),
    peakTotalPrivateMegabytes: peakMegabytes(totalPrivateKilobytes),
  };
};

export const startResourceSampling = async (
  electronApp: ElectronApplication,
  sampleIntervalMs: number
): Promise<ResourceSampler> => {
  if (process.platform !== 'linux') {
    throw new Error(
      'Desktop memory sampling reads /proc/<pid>/smaps_rollup, which only exists on Linux'
    );
  }
  const sampleRounds: ProcessResourceSample[][] = [await sampleProcessMetrics(electronApp)];
  const startedAt = Date.now();
  let isSampling = true;
  let sleepTimeoutId: ReturnType<typeof setTimeout> | undefined;
  let endSleepEarly: (() => void) | undefined;

  const sleepUntilNextSample = (): Promise<void> =>
    new Promise<void>((resolve) => {
      sleepTimeoutId = setTimeout(resolve, sampleIntervalMs);
      endSleepEarly = resolve;
    });

  const samplingLoop = (async () => {
    while (isSampling) {
      await sleepUntilNextSample();
      if (!isSampling) break;
      sampleRounds.push(await sampleProcessMetrics(electronApp));
    }
  })();

  return {
    stop: async () => {
      isSampling = false;
      if (sleepTimeoutId) clearTimeout(sleepTimeoutId);
      endSleepEarly?.();
      await samplingLoop.catch(() => undefined);
      const finalRound = await sampleProcessMetrics(electronApp).catch(() => undefined);
      if (finalRound) sampleRounds.push(finalRound);
      return summarizeResourceSamples(sampleRounds, (Date.now() - startedAt) / 1000);
    },
  };
};

export type RendererMetrics = {
  jsHeapUsedMegabytes: number;
  jsHeapTotalMegabytes: number;
  domNodeCount: number;
  documentCount: number;
  eventListenerCount: number;
};

export type RendererMetricsReader = {
  readAfterGarbageCollection: () => Promise<RendererMetrics>;
  detach: () => Promise<void>;
};

const BYTES_PER_MEGABYTE = 1024 * 1024;

export const createRendererMetricsReader = async (window: Page): Promise<RendererMetricsReader> => {
  const client: CDPSession = await window.context().newCDPSession(window);
  await client.send('Performance.enable');
  await client.send('HeapProfiler.enable');

  return {
    readAfterGarbageCollection: async () => {
      await client.send('HeapProfiler.collectGarbage');
      const { metrics } = await client.send('Performance.getMetrics');
      const valueOf = (name: string): number =>
        metrics.find((metric) => metric.name === name)?.value ?? 0;
      return {
        jsHeapUsedMegabytes: valueOf('JSHeapUsedSize') / BYTES_PER_MEGABYTE,
        jsHeapTotalMegabytes: valueOf('JSHeapTotalSize') / BYTES_PER_MEGABYTE,
        domNodeCount: valueOf('Nodes'),
        documentCount: valueOf('Documents'),
        eventListenerCount: valueOf('JSEventListeners'),
      };
    },
    detach: async () => {
      await client.detach();
    },
  };
};
