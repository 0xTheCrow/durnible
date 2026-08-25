import { test, expect, devices, type CDPSession, type Page } from '@playwright/test';
import type { Settings } from '../../src/app/state/settings';
import {
  seedSession,
  seedSettings,
  stubHomeserver,
  TEST_ROOM_ID,
  textEvent,
} from '../fixtures/homeserver';
import {
  collectKeystrokeTiming,
  createPerformanceSession,
  formatMs,
  installKeystrokeTiming,
  PERFORMANCE_RESULTS_DIR,
  saveCpuProfile,
  saveReport,
  startRendererTrace,
  summarizeProfile,
  summarizeSamples,
  type ProfileSummary,
  type RendererTiming,
  type SampleStats,
} from '../fixtures/performance';

const roomPath = `/home/${encodeURIComponent(TEST_ROOM_ID)}/`;

const CPU_THROTTLING_RATE = Number(process.env.PERFORMANCE_CPU_THROTTLING ?? 4);
const KEYSTROKE_COUNT = Number(process.env.PERFORMANCE_KEYSTROKES ?? 60);
const KEYSTROKE_DELAY_MS = 60;
const PREFILLED_CHARACTER_COUNT = 2000;
const SETTLE_MS = 3000;
const RUN_LABEL = process.env.PERFORMANCE_LABEL ?? '';
const IS_TRACING_RENDERER = process.env.PERFORMANCE_TRACE === '1';
const BUSY_ROOM_MESSAGE_COUNT = Number(process.env.PERFORMANCE_ROOM_MESSAGES ?? 300);
const REPETITION_COUNT = Number(process.env.PERFORMANCE_REPETITIONS ?? 1);
const runFileName = (name: string): string => (RUN_LABEL ? `${name}-${RUN_LABEL}` : name);

const buildTypedText = (characterCount: number, withSpaces: boolean): string => {
  const phrase = withSpaces
    ? 'the quick brown fox jumps over the lazy dog. '
    : 'thequickbrownfoxjumpsoverthelazydog';
  return phrase.repeat(Math.ceil(characterCount / phrase.length)).slice(0, characterCount);
};

const WATCHED_FUNCTIONS = [
  'stripDeadCaretAnchors',
  'normalizeEditorRoot',
  'ensureInlineBoundaryAnchors',
  'isEditorEmpty',
  'hasInlineStyleElement',
  'clearPendingInlineStyles',
  'getActiveEditorFormats',
  'selectionInsideSelector',
  'selectionInsideTag',
  'closestMarkAncestor',
  'handleEditorChange',
  'syncEditorState',
  'handleInput',
  'detectAutocompleteQuery',
];

type ScenarioResult = {
  name: string;
  description: string;
  keydown: SampleStats;
  input: SampleStats;
  keyup: SampleStats;
  frame: SampleStats;
  composition: SampleStats;
  compositionFrame: SampleStats;
  longTaskCount: number;
  renderedMessageCount: number;
  summary: ProfileSummary;
  renderer?: RendererTiming;
  profilePath: string;
};

const results: ScenarioResult[] = [];

test.use({ ...devices['Pixel 5'] });

test.beforeEach(async ({ context }) => {
  await seedSession(context);
});

const prefillEditor = (page: Page, characterCount: number): Promise<void> =>
  page.evaluate((count) => {
    const editor = document.querySelector<HTMLElement>('[data-testid="editor"]');
    if (!editor) throw new Error('editor not found');

    const sentence = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod. ';
    const paragraphCount = 6;
    const perParagraph = Math.ceil(count / paragraphCount);
    const paragraph = sentence
      .repeat(Math.ceil(perParagraph / sentence.length))
      .slice(0, perParagraph);
    editor.replaceChildren(
      ...Array.from({ length: paragraphCount }, () => {
        const block = document.createElement('div');
        block.textContent = paragraph;
        return block;
      })
    );
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, characterCount);

const placeCaretAtEnd = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('[data-testid="editor"]');
    if (!editor) throw new Error('editor not found');
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });

const COMPOSITION_WORDS = ['hello', 'there', 'typing', 'feels', 'slower', 'today'];

const composeText = async (
  page: Page,
  client: CDPSession,
  compositionUpdateCount: number
): Promise<void> => {
  let remainingUpdates = compositionUpdateCount;
  let wordIndex = 0;
  while (remainingUpdates > 0) {
    const word = COMPOSITION_WORDS[wordIndex % COMPOSITION_WORDS.length];
    wordIndex += 1;
    for (let length = 1; length <= word.length && remainingUpdates > 0; length += 1) {
      await client.send('Input.imeSetComposition', {
        text: word.slice(0, length),
        selectionStart: length,
        selectionEnd: length,
      });
      remainingUpdates -= 1;
      await page.waitForTimeout(KEYSTROKE_DELAY_MS);
    }
    await client.send('Input.insertText', { text: `${word} ` });
    await page.waitForTimeout(KEYSTROKE_DELAY_MS);
  }
};

const prefillEditorWithInlineCode = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('[data-testid="editor"]');
    if (!editor) throw new Error('editor not found');
    const block = document.createElement('div');
    const leadingCode = document.createElement('code');
    leadingCode.textContent = 'npm run performance';
    const trailingCode = document.createElement('code');
    trailingCode.textContent = 'PERFORMANCE_KEYSTROKES';
    block.append(leadingCode, document.createTextNode(' between '), trailingCode);
    editor.replaceChildren(block);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  });

type ScenarioOptions = {
  name: string;
  description: string;
  settings?: Partial<Settings>;
  prefill?: boolean;
  prefillInlineCode?: boolean;
  openAutocomplete?: boolean;
  useComposition?: boolean;
  busyRoom?: boolean;
};

const measureTypingScenario = async (
  page: Page,
  {
    name,
    description,
    settings,
    prefill,
    prefillInlineCode,
    openAutocomplete,
    useComposition,
    busyRoom,
  }: ScenarioOptions,
  repetition: number
): Promise<ScenarioResult> => {
  if (settings) await seedSettings(page, settings);
  await stubHomeserver(page, {
    timelineEvents: busyRoom
      ? Array.from({ length: BUSY_ROOM_MESSAGE_COUNT }, (unused, index) => textEvent(index))
      : undefined,
  });
  await page.goto(roomPath);

  const editor = page.getByTestId('editor');
  await expect(editor).toBeVisible();
  await editor.click();

  const renderedMessageCount = await page.getByTestId('message-body').count();
  if (busyRoom) expect(renderedMessageCount).toBeGreaterThan(20);

  if (prefill) await prefillEditor(page, PREFILLED_CHARACTER_COUNT);
  if (prefillInlineCode) await prefillEditorWithInlineCode(page);

  await page.keyboard.type('warmup', { delay: 20 });
  await page.waitForTimeout(SETTLE_MS);
  await placeCaretAtEnd(page);

  if (openAutocomplete) {
    await page.keyboard.type(' @', { delay: 40 });
    await page.waitForTimeout(200);
  }

  const session = await createPerformanceSession(page, {
    cpuThrottlingRate: CPU_THROTTLING_RATE,
  });
  await installKeystrokeTiming(page);
  const rendererTrace = IS_TRACING_RENDERER ? await startRendererTrace(session.client) : undefined;
  await session.start();

  if (useComposition) {
    await composeText(page, session.client, KEYSTROKE_COUNT);
  } else {
    await page.keyboard.type(buildTypedText(KEYSTROKE_COUNT, !openAutocomplete), {
      delay: KEYSTROKE_DELAY_MS,
    });
  }
  await page.waitForTimeout(600);

  const profile = await session.stop();
  const renderer = await rendererTrace?.stop();
  const timing = await collectKeystrokeTiming(page);
  await session.detach();

  const profilePath = await saveCpuProfile(
    profile,
    runFileName(REPETITION_COUNT > 1 ? `typing-${name}-rep${repetition}` : `typing-${name}`)
  );

  return {
    name,
    description,
    keydown: summarizeSamples(timing.keydownBlockMs),
    input: summarizeSamples(timing.inputBlockMs),
    keyup: summarizeSamples(timing.keyupBlockMs),
    frame: summarizeSamples(timing.frameMs),
    composition: summarizeSamples(timing.compositionBlockMs),
    compositionFrame: summarizeSamples(timing.compositionFrameMs),
    longTaskCount: timing.longTaskMs.length,
    renderedMessageCount,
    summary: summarizeProfile(profile),
    renderer,
    profilePath,
  };
};

const medianOf = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const formatRange = (values: number[]): string =>
  values.length > 1
    ? `${formatMs(Math.min(...values))}\u2013${formatMs(Math.max(...values))}`
    : '\u2014';

const metricRow = (label: string, statsPerRepetition: SampleStats[]): string => {
  if (statsPerRepetition.every((stats) => stats.count === 0)) return '';
  const p50s = statsPerRepetition.map((stats) => stats.p50Ms);
  const p95s = statsPerRepetition.map((stats) => stats.p95Ms);
  const maxes = statsPerRepetition.map((stats) => stats.maxMs);
  return (
    `| ${label} | ${formatMs(medianOf(p50s))} | ${formatRange(p50s)} | ` +
    `${formatMs(medianOf(p95s))} | ${formatMs(Math.max(...maxes))} |`
  );
};

const perKeystrokeMs = (totalMs: number): string => formatMs(totalMs / KEYSTROKE_COUNT);

const costRow = (label: string, totalMs: number, sharePercent: number): string =>
  `| ${label} | ${perKeystrokeMs(totalMs)} | ${formatMs(totalMs)} | ${sharePercent.toFixed(1)}% |`;

const renderScenario = (repetitions: ScenarioResult[]): string => {
  const busyPerRepetition = repetitions.map((result) => result.summary.activeMs);
  const representative = [...repetitions].sort((a, b) => a.summary.activeMs - b.summary.activeMs)[
    Math.floor(repetitions.length / 2)
  ];
  const { summary } = representative;

  const metricRows = [
    metricRow(
      'keydown task block (ms)',
      repetitions.map((result) => result.keydown)
    ),
    metricRow(
      'input task block (ms)',
      repetitions.map((result) => result.input)
    ),
    metricRow(
      'keyup task block (ms)',
      repetitions.map((result) => result.keyup)
    ),
    metricRow(
      'keydown to painted frame (ms)',
      repetitions.map((result) => result.frame)
    ),
    metricRow(
      'composition task block (ms)',
      repetitions.map((result) => result.composition)
    ),
    metricRow(
      'composition to painted frame (ms)',
      repetitions.map((result) => result.compositionFrame)
    ),
  ].filter((row) => row !== '');

  const lines = [
    `## ${representative.name}`,
    '',
    representative.description,
    '',
    `| metric | p50 | p50 across ${repetitions.length} rep(s) | p95 | max |`,
    '| --- | --- | --- | --- | --- |',
    ...metricRows,
  ];

  lines.push(
    '',
    `Main thread busy: ${formatMs(medianOf(busyPerRepetition))}ms ` +
      `(range ${formatRange(busyPerRepetition)} over ${repetitions.length} rep(s))`,
    '',
    `Rendered messages in timeline: ${representative.renderedMessageCount}`,
    '',
    `Long tasks (>50ms), median across reps: ${medianOf(repetitions.map((r) => r.longTaskCount))}`,
    '',
    `Profile tables below come from the median repetition by busy time. Of its ` +
      `${formatMs(summary.activeMs)}ms busy, ${formatMs(summary.unattributedMs)}ms sat in engine ` +
      `frames with no JS on the stack; the tables rank the remaining ` +
      `${formatMs(summary.activeMs - summary.unattributedMs)}ms of attributed JS.`,
    '',
    '### Self time by source file (top 12)',
    '',
    '| source | ms/keystroke | total ms | share of busy |',
    '| --- | --- | --- | --- |',
    ...summary.bySourceFile
      .slice(0, 12)
      .map((entry) => costRow(entry.label, entry.selfMs, entry.sharePercent)),
    '',
    '### Self time by function (top 15)',
    '',
    '| function | ms/keystroke | total ms | share of busy |',
    '| --- | --- | --- | --- |',
    ...summary.byFunction
      .slice(0, 15)
      .map((entry) => costRow(entry.label, entry.selfMs, entry.sharePercent)),
    '',
    '### Watched editor functions (inclusive time, includes native DOM calls they make)',
    '',
    '| function | ms/keystroke | total ms | share of busy |',
    '| --- | --- | --- | --- |'
  );

  const watched = WATCHED_FUNCTIONS.map((functionName) => ({
    functionName,
    inclusiveMs: summary.inclusiveMsByFunctionName.get(functionName) ?? 0,
  }))
    .filter((entry) => entry.inclusiveMs > 0)
    .sort((a, b) => b.inclusiveMs - a.inclusiveMs);

  if (watched.length === 0) {
    lines.push('| (none sampled) | 0.0 | 0.0 | 0.0% |');
  } else {
    watched.forEach((entry) => {
      const share = summary.activeMs > 0 ? (entry.inclusiveMs / summary.activeMs) * 100 : 0;
      lines.push(costRow(entry.functionName, entry.inclusiveMs, share));
    });
  }

  const { renderer } = representative;
  if (renderer) {
    lines.push(
      '',
      '### Renderer phases (devtools.timeline, inclusive of nested work)',
      '',
      '| phase | total ms |',
      '| --- | --- |',
      `| style recalc (UpdateLayoutTree) | ${formatMs(renderer.styleMs)} |`,
      `| layout (Layout) | ${formatMs(renderer.layoutMs)} |`,
      `| paint (Paint + Commit) | ${formatMs(renderer.paintMs)} |`,
      '',
      '#### Top trace events',
      '',
      '| event | total ms | count |',
      '| --- | --- | --- |',
      ...renderer.byEvent
        .slice(0, 15)
        .map((event) => `| ${event.name} | ${formatMs(event.totalMs)} | ${event.count} |`)
    );
  }

  lines.push('', `CPU profile (median repetition): \`${representative.profilePath}\``, '');
  return lines.join('\n');
};

const SCENARIOS: ScenarioOptions[] = [
  {
    name: 'empty-composer',
    description: 'Baseline. Typing into an empty composer with default settings.',
  },
  {
    name: 'long-message',
    description: `Composer pre-filled with ~${PREFILLED_CHARACTER_COUNT} characters across 6 blocks, then typed at the end. Isolates per-keystroke work that scales with document size.`,
    prefill: true,
  },
  {
    name: 'long-message-toolbar',
    description:
      'Same as long message, with the editor toolbar enabled. Isolates the toolbar re-render cost.',
    settings: { editorToolbar: true },
    prefill: true,
  },
  {
    name: 'autocomplete-open',
    description:
      'Typing with an active @ autocomplete query. Isolates the cost of re-rendering while a query is open.',
    openAutocomplete: true,
  },
  {
    name: 'composition',
    description:
      'Predictive/IME keyboard composing words via Input.imeSetComposition rather than discrete keystrokes. This is the mobile soft-keyboard path; the other scenarios never produce composition events.',
    useComposition: true,
  },
  {
    name: 'composition-inline-code',
    description:
      'Composition typing with inline code at both block boundaries, so ensureInlineBoundaryAnchors and stripDeadCaretAnchors actually mutate and reset the selection on each edit.',
    prefillInlineCode: true,
    useComposition: true,
  },
  {
    name: 'busy-room',
    description: `Typing into an empty composer in a room seeded with ${BUSY_ROOM_MESSAGE_COUNT} timeline messages, rather than the near-empty room every other scenario uses.`,
    busyRoom: true,
  },
];

test.describe('composer typing cost', () => {
  test.describe.configure({ mode: 'serial' });

  for (let repetition = 1; repetition <= REPETITION_COUNT; repetition += 1) {
    SCENARIOS.forEach((scenario) => {
      test(`${scenario.name} (rep ${repetition}/${REPETITION_COUNT})`, async ({ page }) => {
        results.push(await measureTypingScenario(page, scenario, repetition));
      });
    });
  }

  test.afterAll(async () => {
    if (results.length === 0) return;

    const scenarioNames = [...new Set(results.map((result) => result.name))];
    const groups = scenarioNames.map((name) => results.filter((result) => result.name === name));

    const report = [
      '# Composer typing performance',
      '',
      `- CPU throttling: ${CPU_THROTTLING_RATE}x`,
      `- Viewport: Pixel 5`,
      `- Keystrokes per scenario: ${KEYSTROKE_COUNT} at ${KEYSTROKE_DELAY_MS}ms intervals`,
      `- Repetitions: ${REPETITION_COUNT} (scenarios interleaved, not batched)`,
      `- Generated: ${new Date().toISOString()}`,
      '',
      'Rank scenarios on busy time, not p50. Across identical runs busy reproduces to within a few',
      'percent while p50 swings much more, so a p50 gap narrower than the range column is noise.',
      '',
      ...groups.map(renderScenario),
    ].join('\n');

    const reportPath = await saveReport(`${runFileName('typing')}.md`, report);
    process.stdout.write(`\nPerformance report: ${reportPath}\n`);
    process.stdout.write(`Profiles: ${PERFORMANCE_RESULTS_DIR}\n\n`);

    groups.forEach((group) => {
      const busyPerRepetition = group.map((result) => result.summary.activeMs);
      const isComposition = group[0].composition.count > 0;
      const framePerRepetition = group.map((result) =>
        isComposition ? result.compositionFrame.p50Ms : result.frame.p50Ms
      );
      const frameMedianMs = formatMs(medianOf(framePerRepetition)).padStart(6);
      const busyMedianMs = formatMs(medianOf(busyPerRepetition)).padStart(8);
      const frameRangeCell = `[${formatRange(framePerRepetition)}]`.padEnd(18);
      process.stdout.write(
        `${group[0].name.padEnd(
          26
        )} frame p50 ${frameMedianMs}ms ${frameRangeCell}busy ${busyMedianMs}ms [${formatRange(
          busyPerRepetition
        )}]\n`
      );
    });
  });
});
