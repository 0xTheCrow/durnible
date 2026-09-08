import { mkdtemp, rm } from 'node:fs/promises';
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

type ProcessResourceSample = {
  processLabel: string;
  pid: number;
  cumulativeCpuSeconds: number;
  workingSetKilobytes: number;
};

export type ProcessResourceUsage = {
  processLabel: string;
  cpuSeconds: number;
  cpuCores: number;
  meanWorkingSetMegabytes: number;
  peakWorkingSetMegabytes: number;
};

export type ResourceUsage = {
  wallClockSeconds: number;
  sampleCount: number;
  byProcess: ProcessResourceUsage[];
  totalCpuSeconds: number;
  totalCpuCores: number;
  meanTotalWorkingSetMegabytes: number;
  peakTotalWorkingSetMegabytes: number;
};

export type ResourceSampler = {
  stop: () => Promise<ResourceUsage>;
};

const KILOBYTES_PER_MEGABYTE = 1024;

const sampleProcessMetrics = (electronApp: ElectronApplication): Promise<ProcessResourceSample[]> =>
  electronApp.evaluate(({ app }) =>
    (app.getAppMetrics() as ElectronProcessMetric[]).map((metric) => ({
      processLabel: metric.serviceName ? `${metric.type} (${metric.serviceName})` : metric.type,
      pid: metric.pid,
      cumulativeCpuSeconds: metric.cpu.cumulativeCPUUsage ?? 0,
      workingSetKilobytes: metric.memory.workingSetSize,
    }))
  );

const summarizeResourceSamples = (
  sampleRounds: ProcessResourceSample[][],
  wallClockSeconds: number
): ResourceUsage => {
  const firstByPid = new Map<number, ProcessResourceSample>();
  const lastByPid = new Map<number, ProcessResourceSample>();
  const workingSetKilobytesByLabel = new Map<string, number[]>();

  sampleRounds.forEach((round) => {
    const roundKilobytesByLabel = new Map<string, number>();
    round.forEach((sample) => {
      if (!firstByPid.has(sample.pid)) firstByPid.set(sample.pid, sample);
      lastByPid.set(sample.pid, sample);
      roundKilobytesByLabel.set(
        sample.processLabel,
        (roundKilobytesByLabel.get(sample.processLabel) ?? 0) + sample.workingSetKilobytes
      );
    });
    roundKilobytesByLabel.forEach((kilobytes, processLabel) => {
      const existing = workingSetKilobytesByLabel.get(processLabel);
      if (existing) existing.push(kilobytes);
      else workingSetKilobytesByLabel.set(processLabel, [kilobytes]);
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

  const byProcess = [...workingSetKilobytesByLabel.entries()]
    .map(([processLabel, workingSetKilobytes]) => {
      const cpuSeconds = cpuSecondsByLabel.get(processLabel) ?? 0;
      const totalKilobytes = workingSetKilobytes.reduce((sum, value) => sum + value, 0);
      return {
        processLabel,
        cpuSeconds,
        cpuCores: wallClockSeconds > 0 ? cpuSeconds / wallClockSeconds : 0,
        meanWorkingSetMegabytes:
          totalKilobytes / workingSetKilobytes.length / KILOBYTES_PER_MEGABYTE,
        peakWorkingSetMegabytes: Math.max(...workingSetKilobytes) / KILOBYTES_PER_MEGABYTE,
      };
    })
    .sort((a, b) => b.cpuSeconds - a.cpuSeconds);

  const totalWorkingSetKilobytesPerRound = sampleRounds.map((round) =>
    round.reduce((sum, sample) => sum + sample.workingSetKilobytes, 0)
  );
  const totalCpuSeconds = [...cpuSecondsByLabel.values()].reduce((sum, value) => sum + value, 0);

  return {
    wallClockSeconds,
    sampleCount: sampleRounds.length,
    byProcess,
    totalCpuSeconds,
    totalCpuCores: wallClockSeconds > 0 ? totalCpuSeconds / wallClockSeconds : 0,
    meanTotalWorkingSetMegabytes:
      totalWorkingSetKilobytesPerRound.reduce((sum, value) => sum + value, 0) /
      totalWorkingSetKilobytesPerRound.length /
      KILOBYTES_PER_MEGABYTE,
    peakTotalWorkingSetMegabytes:
      Math.max(...totalWorkingSetKilobytesPerRound) / KILOBYTES_PER_MEGABYTE,
  };
};

export const startResourceSampling = async (
  electronApp: ElectronApplication,
  sampleIntervalMs: number
): Promise<ResourceSampler> => {
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
