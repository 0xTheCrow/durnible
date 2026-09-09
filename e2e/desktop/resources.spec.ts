import { test, expect, type Page } from '@playwright/test';
import {
  historyEvent,
  liveMessageEvent,
  seedSession,
  stubHomeserver,
  textEvent,
  TEST_ROOM_ID,
  TEST_ROOM_NAME,
  type HomeserverStub,
} from '../fixtures/homeserver';
import {
  createRendererMetricsReader,
  DESKTOP_APP_ORIGIN,
  launchDesktopApp,
  startResourceSampling,
  type DesktopApp,
  type RendererMetrics,
  type ResourceUsage,
} from '../fixtures/desktopApp';
import {
  collectLongTaskTiming,
  createPerformanceSession,
  installLongTaskTiming,
  PERFORMANCE_RESULTS_DIR,
  saveCpuProfile,
  saveReport,
  startRendererTrace,
  summarizeLongTasks,
  summarizeProfile,
  type LongTaskStats,
  type ProfileSummary,
  type RendererTiming,
} from '../fixtures/performance';
import { PAGINATION_LIMIT } from '../../src/app/features/room/timeline/timelineState';

const roomPath = `${DESKTOP_APP_ORIGIN}/home/${encodeURIComponent(TEST_ROOM_ID)}/`;
const homePath = `${DESKTOP_APP_ORIGIN}/home/`;

const SAMPLE_INTERVAL_MS = 500;
const SETTLE_MS = 5000;
const POST_DRIVE_SETTLE_MS = 2000;
const BOOT_TIMEOUT_MS = 30_000;
const durationFromEnvironment = (name: string, fallbackMs: number): number => {
  const configured = process.env[name];
  if (configured === undefined) return fallbackMs;
  const parsed = Number(configured);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number of milliseconds, got "${configured}"`);
  }
  return parsed;
};

const IDLE_DURATION_MS = durationFromEnvironment('PERFORMANCE_DESKTOP_IDLE_MS', 15_000);
const INCOMING_DURATION_MS = durationFromEnvironment('PERFORMANCE_DESKTOP_INCOMING_MS', 15_000);
const INCOMING_INTERVAL_MS = 250;
const TYPED_CHARACTER_COUNT = 80;
const KEYSTROKE_DELAY_MS = 60;
const SCROLL_STEP_COUNT = 24;
const SCROLL_STEP_PX = 600;
const SCROLL_STEP_DELAY_MS = 150;
const LEAK_CYCLE_COUNT = 20;
const TIMELINE_MESSAGE_COUNT = 300;
const SCROLL_TIMELINE_MESSAGE_COUNT = PAGINATION_LIMIT + 40;
const SCROLL_HISTORY_MESSAGE_COUNT = 240;
const RUN_LABEL = process.env.PERFORMANCE_LABEL ?? '';
const IS_PROFILING = process.env.PERFORMANCE_DESKTOP_PROFILE === '1';

const runFileName = (name: string): string => (RUN_LABEL ? `${name}-${RUN_LABEL}` : name);

const timelineScrollSelector = '[data-testid="timeline-scroll"]';

const buildTextEvents = (count: number): Record<string, unknown>[] =>
  Array.from({ length: count }, (unused, index) => textEvent(index));

const buildHistoryEvents = (count: number): Record<string, unknown>[] =>
  Array.from({ length: count }, (unused, index) => historyEvent(index));

const waitForComposer = async (window: Page): Promise<void> => {
  await expect(window.getByTestId('editor')).toBeVisible({ timeout: BOOT_TIMEOUT_MS });
};

const waitForRoomLink = async (window: Page): Promise<void> => {
  await expect(window.getByRole('link', { name: TEST_ROOM_NAME })).toBeVisible({
    timeout: BOOT_TIMEOUT_MS,
  });
};

const waitForRoomClosed = async (window: Page): Promise<void> => {
  await expect(window.getByTestId('editor')).toBeHidden({ timeout: BOOT_TIMEOUT_MS });
};

type ScenarioDefinition = {
  name: string;
  description: string;
  timelineEvents: Record<string, unknown>[];
  historyEvents?: Record<string, unknown>[];
  entryPath: string;
  waitForReady: (window: Page) => Promise<void>;
  warmUp?: (window: Page) => Promise<void>;
  drive: (window: Page, stub: HomeserverStub) => Promise<void>;
};

type ScenarioResult = {
  name: string;
  description: string;
  usage: ResourceUsage;
  longTasks: LongTaskStats;
  rendererBefore: RendererMetrics;
  rendererAfter: RendererMetrics;
  profileSummary?: ProfileSummary;
  profilePath?: string;
  rendererTiming?: RendererTiming;
};

const results: ScenarioResult[] = [];

const openAndCloseRoom = async (window: Page): Promise<void> => {
  await window.getByRole('link', { name: TEST_ROOM_NAME }).click();
  await waitForComposer(window);
  await expect(window.getByTestId('message-body').first()).toBeVisible({
    timeout: BOOT_TIMEOUT_MS,
  });
  await window.goBack();
  await waitForRoomClosed(window);
};

const scrollTimeline = async (window: Page, stepPx: number): Promise<void> => {
  await window.locator(timelineScrollSelector).hover();
  for (let step = 0; step < SCROLL_STEP_COUNT; step += 1) {
    await window.mouse.wheel(0, stepPx);
    await window.waitForTimeout(SCROLL_STEP_DELAY_MS);
  }
};

const SCENARIOS: ScenarioDefinition[] = [
  {
    name: 'idle-in-room',
    description: `Room with ${TIMELINE_MESSAGE_COUNT} messages open and untouched for ${
      IDLE_DURATION_MS / 1000
    }s. This is the steady state the app sits in most of the day, so anything but near-zero CPU here is background work that should not be running.`,
    timelineEvents: buildTextEvents(TIMELINE_MESSAGE_COUNT),
    entryPath: roomPath,
    waitForReady: waitForComposer,
    drive: (window) => window.waitForTimeout(IDLE_DURATION_MS),
  },
  {
    name: 'idle-on-room-list',
    description: `The room list with no room open, untouched for ${
      IDLE_DURATION_MS / 1000
    }s. Control for idle-in-room: the same app, the same harness attached, without the room view mounted. Subtract this from idle-in-room to get what having a room open actually costs.`,
    timelineEvents: buildTextEvents(TIMELINE_MESSAGE_COUNT),
    entryPath: homePath,
    waitForReady: waitForRoomLink,
    drive: (window) => window.waitForTimeout(IDLE_DURATION_MS),
  },
  {
    name: 'timeline-scroll',
    description: `Wheel-scrolling up through ${SCROLL_TIMELINE_MESSAGE_COUNT} loaded messages into ${SCROLL_HISTORY_MESSAGE_COUNT} paginated history events, then back down. Covers virtualizer churn plus the backward-pagination fetch and mount.`,
    timelineEvents: buildTextEvents(SCROLL_TIMELINE_MESSAGE_COUNT),
    historyEvents: buildHistoryEvents(SCROLL_HISTORY_MESSAGE_COUNT),
    entryPath: roomPath,
    waitForReady: waitForComposer,
    drive: async (window) => {
      await scrollTimeline(window, -SCROLL_STEP_PX);
      await scrollTimeline(window, SCROLL_STEP_PX);
    },
  },
  {
    name: 'typing-burst',
    description: `${TYPED_CHARACTER_COUNT} keystrokes at ${KEYSTROKE_DELAY_MS}ms intervals into the composer. The per-keystroke latency breakdown lives in the typing benchmark; this measures what that work costs in CPU seconds and renderer heap.`,
    timelineEvents: buildTextEvents(TIMELINE_MESSAGE_COUNT),
    entryPath: roomPath,
    waitForReady: waitForComposer,
    drive: async (window) => {
      await window.getByTestId('editor').click();
      await window.keyboard.type(
        'the quick brown fox jumps over the lazy dog. '.repeat(2).slice(0, TYPED_CHARACTER_COUNT),
        {
          delay: KEYSTROKE_DELAY_MS,
        }
      );
    },
  },
  {
    name: 'incoming-messages',
    description: `A live message arriving every ${INCOMING_INTERVAL_MS}ms for ${
      INCOMING_DURATION_MS / 1000
    }s while the room is open and scrolled to the latest message. Covers sync handling, timeline append and autoscroll.`,
    timelineEvents: buildTextEvents(TIMELINE_MESSAGE_COUNT),
    entryPath: roomPath,
    waitForReady: waitForComposer,
    drive: async (window, stub) => {
      const messageCount = Math.floor(INCOMING_DURATION_MS / INCOMING_INTERVAL_MS);
      for (let index = 0; index < messageCount; index += 1) {
        stub.pushTimeline([liveMessageEvent(`$incoming${index}`, `incoming message ${index}`)]);
        await window.waitForTimeout(INCOMING_INTERVAL_MS);
      }
    },
  },
  {
    name: 'leak-cycle',
    description: `${LEAK_CYCLE_COUNT} in-app round trips between the room list and the room, without reloading the window, measured from a warmed-up state so the one-time cost of the first room open is excluded. Both readings are taken with the room closed, so heap, DOM nodes and listeners should all land back where they started.`,
    timelineEvents: buildTextEvents(TIMELINE_MESSAGE_COUNT),
    entryPath: homePath,
    waitForReady: waitForRoomLink,
    warmUp: openAndCloseRoom,
    drive: async (window) => {
      for (let cycle = 0; cycle < LEAK_CYCLE_COUNT; cycle += 1) {
        await openAndCloseRoom(window);
      }
    },
  },
];

const measureScenario = async (scenario: ScenarioDefinition): Promise<ScenarioResult> => {
  const app: DesktopApp = await launchDesktopApp();
  try {
    const { electronApp, window } = app;
    await seedSession(window.context());
    const stub = await stubHomeserver(window, {
      timelineEvents: scenario.timelineEvents,
      historyEvents: scenario.historyEvents,
    });

    await window.goto(scenario.entryPath);
    await scenario.waitForReady(window);
    await window.waitForTimeout(SETTLE_MS);
    await scenario.warmUp?.(window);

    const rendererMetricsReader = await createRendererMetricsReader(window);
    const rendererBefore = await rendererMetricsReader.readAfterGarbageCollection();

    const profilingSession = IS_PROFILING ? await createPerformanceSession(window) : undefined;
    const rendererTrace = profilingSession
      ? await startRendererTrace(profilingSession.client)
      : undefined;
    await profilingSession?.start();

    await installLongTaskTiming(window);
    const sampler = await startResourceSampling(electronApp, SAMPLE_INTERVAL_MS);
    let usage: ResourceUsage;
    try {
      await scenario.drive(window, stub);
    } finally {
      usage = await sampler.stop();
    }
    const longTasks = summarizeLongTasks(await collectLongTaskTiming(window));

    const profile = await profilingSession?.stop();
    const rendererTiming = await rendererTrace?.stop();
    await profilingSession?.detach();

    await window.waitForTimeout(POST_DRIVE_SETTLE_MS);
    const rendererAfter = await rendererMetricsReader.readAfterGarbageCollection();
    await rendererMetricsReader.detach();

    return {
      name: scenario.name,
      description: scenario.description,
      usage,
      longTasks,
      rendererBefore,
      rendererAfter,
      profileSummary: profile ? summarizeProfile(profile) : undefined,
      rendererTiming,
      profilePath: profile
        ? await saveCpuProfile(profile, runFileName(`desktop-${scenario.name}`))
        : undefined,
    };
  } finally {
    await app.close();
  }
};

const formatNumber = (value: number): string => value.toFixed(1);

const formatCores = (value: number): string => value.toFixed(2);

const formatSignedNumber = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;

const formatSignedCount = (value: number): string => `${value >= 0 ? '+' : ''}${value}`;

const renderScenario = (result: ScenarioResult): string => {
  const { usage, rendererBefore, rendererAfter } = result;
  return [
    `## ${result.name}`,
    '',
    result.description,
    '',
    `Window: ${formatNumber(usage.wallClockSeconds)}s, ${usage.sampleCount} samples`,
    '',
    '| process | CPU seconds | cores | mean RSS (MB) | peak RSS (MB) |',
    '| --- | --- | --- | --- | --- |',
    ...usage.byProcess.map(
      (process) =>
        `| ${process.processLabel} | ${process.cpuSeconds.toFixed(2)} | ` +
        `${formatCores(process.cpuCores)} | ` +
        `${formatNumber(process.meanWorkingSetMegabytes)} | ` +
        `${formatNumber(process.peakWorkingSetMegabytes)} |`
    ),
    `| **all processes** | **${usage.totalCpuSeconds.toFixed(2)}** | ` +
      `**${formatCores(usage.totalCpuCores)}** | ` +
      `**${formatNumber(usage.meanTotalWorkingSetMegabytes)}** | ` +
      `**${formatNumber(usage.peakTotalWorkingSetMegabytes)}** |`,
    '',
    '| main thread | value |',
    '| --- | --- |',
    `| long tasks (>50ms) | ${result.longTasks.count} |`,
    `| total blocking time | ${formatNumber(result.longTasks.totalBlockingMs)}ms |`,
    `| longest task | ${formatNumber(result.longTasks.longestMs)}ms |`,
    '',
    '| renderer metric | before | after | delta |',
    '| --- | --- | --- | --- |',
    `| JS heap used (MB) | ${formatNumber(rendererBefore.jsHeapUsedMegabytes)} | ` +
      `${formatNumber(rendererAfter.jsHeapUsedMegabytes)} | ` +
      `${formatSignedNumber(
        rendererAfter.jsHeapUsedMegabytes - rendererBefore.jsHeapUsedMegabytes
      )} |`,
    `| JS heap total (MB) | ${formatNumber(rendererBefore.jsHeapTotalMegabytes)} | ` +
      `${formatNumber(rendererAfter.jsHeapTotalMegabytes)} | ` +
      `${formatSignedNumber(
        rendererAfter.jsHeapTotalMegabytes - rendererBefore.jsHeapTotalMegabytes
      )} |`,
    `| DOM nodes | ${rendererBefore.domNodeCount} | ${rendererAfter.domNodeCount} | ` +
      `${formatSignedCount(rendererAfter.domNodeCount - rendererBefore.domNodeCount)} |`,
    `| documents | ${rendererBefore.documentCount} | ${rendererAfter.documentCount} | ` +
      `${formatSignedCount(rendererAfter.documentCount - rendererBefore.documentCount)} |`,
    `| event listeners | ${rendererBefore.eventListenerCount} | ` +
      `${rendererAfter.eventListenerCount} | ` +
      `${formatSignedCount(
        rendererAfter.eventListenerCount - rendererBefore.eventListenerCount
      )} |`,
    '',
    ...renderProfileTables(result),
  ].join('\n');
};

const PROFILE_ENTRY_LIMIT = 15;

const renderProfileTables = (result: ScenarioResult): string[] => {
  const summary = result.profileSummary;
  if (!summary) return [];

  const entryRow = (label: string, selfMs: number, sharePercent: number): string =>
    `| ${label} | ${formatNumber(selfMs)} | ${sharePercent.toFixed(1)}% |`;

  return [
    `Renderer JS sampled over ${formatNumber(summary.sampledMs)}ms: ` +
      `${formatNumber(summary.activeMs)}ms busy, of which ` +
      `${formatNumber(summary.unattributedMs)}ms sat in engine frames with no JS on the stack.`,
    '',
    '### Idle self time by source file',
    '',
    '| source | total ms | share of attributed |',
    '| --- | --- | --- |',
    ...summary.bySourceFile
      .slice(0, PROFILE_ENTRY_LIMIT)
      .map((entry) => entryRow(entry.label, entry.selfMs, entry.sharePercent)),
    '',
    '### Idle self time by function',
    '',
    '| function | total ms | share of attributed |',
    '| --- | --- | --- |',
    ...summary.byFunction
      .slice(0, PROFILE_ENTRY_LIMIT)
      .map((entry) => entryRow(entry.label, entry.selfMs, entry.sharePercent)),
    '',
    ...renderRendererPhaseTables(result.rendererTiming),
    `CPU profile: \`${result.profilePath}\``,
    '',
  ];
};

const renderMemorySummary = (scenarioResults: ScenarioResult[]): string[] => {
  const peakByLabel = new Map<string, number>();
  scenarioResults.forEach((result) => {
    result.usage.byProcess.forEach((process) => {
      peakByLabel.set(
        process.processLabel,
        Math.max(peakByLabel.get(process.processLabel) ?? 0, process.peakWorkingSetMegabytes)
      );
    });
  });

  const peakScenario = [...scenarioResults].sort(
    (a, b) => b.usage.peakTotalWorkingSetMegabytes - a.usage.peakTotalWorkingSetMegabytes
  )[0];
  const peakHeapScenario = [...scenarioResults].sort(
    (a, b) => b.rendererAfter.jsHeapUsedMegabytes - a.rendererAfter.jsHeapUsedMegabytes
  )[0];

  return [
    '## Memory across the whole run',
    '',
    '| process | peak RSS (MB) |',
    '| --- | --- |',
    ...[...peakByLabel.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(
        ([processLabel, peakMegabytes]) => `| ${processLabel} | ${formatNumber(peakMegabytes)} |`
      ),
    `| **all processes** | **${formatNumber(peakScenario.usage.peakTotalWorkingSetMegabytes)}** |`,
    '',
    `Highest total was \`${peakScenario.name}\` at ` +
      `${formatNumber(
        peakScenario.usage.peakTotalWorkingSetMegabytes
      )}MB. Highest renderer JS heap ` +
      `was \`${peakHeapScenario.name}\` at ` +
      `${formatNumber(peakHeapScenario.rendererAfter.jsHeapUsedMegabytes)}MB.`,
    '',
  ];
};

const renderRendererPhaseTables = (rendererTiming: RendererTiming | undefined): string[] => {
  if (!rendererTiming) return [];
  return [
    '### Renderer phases (devtools.timeline, inclusive of nested work)',
    '',
    '| phase | total ms |',
    '| --- | --- |',
    `| style recalc (UpdateLayoutTree) | ${formatNumber(rendererTiming.styleMs)} |`,
    `| layout (Layout) | ${formatNumber(rendererTiming.layoutMs)} |`,
    `| paint (Paint + Commit) | ${formatNumber(rendererTiming.paintMs)} |`,
    '',
    '#### Top trace events',
    '',
    '| event | total ms | count |',
    '| --- | --- | --- |',
    ...rendererTiming.byEvent
      .slice(0, PROFILE_ENTRY_LIMIT)
      .map((event) => `| ${event.name} | ${formatNumber(event.totalMs)} | ${event.count} |`),
    '',
  ];
};

test.describe('desktop resource usage', () => {
  test.describe.configure({ mode: 'serial' });

  SCENARIOS.forEach((scenario) => {
    test(scenario.name, async () => {
      results.push(await measureScenario(scenario));
    });
  });

  test.afterAll(async () => {
    if (results.length === 0) return;

    const report = [
      '# Desktop resource usage',
      '',
      `- Generated: ${new Date().toISOString()}`,
      `- Sampling interval: ${SAMPLE_INTERVAL_MS}ms`,
      `- Settle before sampling: ${SETTLE_MS}ms`,
      `- Settle after driving, before the second renderer reading: ${POST_DRIVE_SETTLE_MS}ms`,
      `- Content size: 1280x800, fresh user-data dir per scenario, unpackaged build (no update checks)`,
      '',
      'Cores: CPU seconds summed across processes divided by wall clock (Chrome `cpuTimeMetric`).',
      '1.00 means one core saturated for the window; processes run in parallel, so totals exceed it.',
      'Total blocking time: the portion of each main-thread task beyond 50ms (Lighthouse).',
      'RSS: Chromium working set, counting shared pages in every process that maps them.',
      '',
      'These are report-only numbers. They are comparable between runs on the same machine and',
      'nowhere else; a scenario is a regression only against a baseline captured on the same box.',
      '',
      ...renderMemorySummary(results),
      ...results.map(renderScenario),
    ].join('\n');

    const reportPath = await saveReport(
      RUN_LABEL ? `desktop-resources-${RUN_LABEL}.md` : 'desktop-resources.md',
      report
    );
    process.stdout.write(`\nDesktop resource report: ${reportPath}\n`);
    process.stdout.write(`Results directory: ${PERFORMANCE_RESULTS_DIR}\n\n`);

    results.forEach((result) => {
      const { usage } = result;
      process.stdout.write(
        `${result.name.padEnd(20)} ${usage.totalCpuSeconds.toFixed(2).padStart(6)}s cpu over ` +
          `${formatNumber(usage.wallClockSeconds).padStart(5)}s (${formatCores(
            usage.totalCpuCores
          )} cores)  blocking ${formatNumber(result.longTasks.totalBlockingMs).padStart(6)}ms in ` +
          `${String(result.longTasks.count).padStart(3)} long tasks  peak RSS ${formatNumber(
            usage.peakTotalWorkingSetMegabytes
          ).padStart(7)}MB  heap ${formatNumber(result.rendererAfter.jsHeapUsedMegabytes).padStart(
            6
          )}MB (${formatSignedNumber(
            result.rendererAfter.jsHeapUsedMegabytes - result.rendererBefore.jsHeapUsedMegabytes
          )})\n`
      );
    });
  });
});
