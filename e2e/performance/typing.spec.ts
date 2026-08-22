import { test, expect, devices, type CDPSession, type Page } from '@playwright/test';
import type { Settings } from '../../src/app/state/settings';
import { seedSession, seedSettings, stubHomeserver, TEST_ROOM_ID } from '../fixtures/homeserver';
import {
  collectKeystrokeTiming,
  createPerformanceSession,
  formatMs,
  installKeystrokeTiming,
  PERFORMANCE_RESULTS_DIR,
  saveCpuProfile,
  saveReport,
  summarizeProfile,
  summarizeSamples,
  type ProfileSummary,
  type SampleStats,
} from '../fixtures/performance';

const roomPath = `/home/${encodeURIComponent(TEST_ROOM_ID)}/`;

const CPU_THROTTLING_RATE = Number(process.env.PERFORMANCE_CPU_THROTTLING ?? 4);
const KEYSTROKE_COUNT = Number(process.env.PERFORMANCE_KEYSTROKES ?? 60);
const KEYSTROKE_DELAY_MS = 60;
const PREFILLED_CHARACTER_COUNT = 2000;
const SETTLE_MS = 3000;
const RUN_LABEL = process.env.PERFORMANCE_LABEL ?? '';
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
  summary: ProfileSummary;
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
  }: ScenarioOptions
): Promise<ScenarioResult> => {
  if (settings) await seedSettings(page, settings);
  await stubHomeserver(page);
  await page.goto(roomPath);

  const editor = page.getByTestId('editor');
  await expect(editor).toBeVisible();
  await editor.click();

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
  const timing = await collectKeystrokeTiming(page);
  await session.detach();

  const profilePath = await saveCpuProfile(profile, runFileName(`typing-${name}`));

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
    summary: summarizeProfile(profile),
    profilePath,
  };
};

const statsRow = (label: string, stats: SampleStats): string =>
  `| ${label} | ${stats.count} | ${formatMs(stats.meanMs)} | ${formatMs(stats.p50Ms)} | ` +
  `${formatMs(stats.p95Ms)} | ${formatMs(stats.maxMs)} |`;

const perKeystrokeMs = (totalMs: number): string => formatMs(totalMs / KEYSTROKE_COUNT);

const costRow = (label: string, totalMs: number, sharePercent: number): string =>
  `| ${label} | ${perKeystrokeMs(totalMs)} | ${formatMs(totalMs)} | ${sharePercent.toFixed(1)}% |`;

const renderScenario = (result: ScenarioResult): string => {
  const { summary } = result;
  const lines = [
    `## ${result.name}`,
    '',
    result.description,
    '',
    '| metric | samples | mean | p50 | p95 | max |',
    '| --- | --- | --- | --- | --- | --- |',
    statsRow('keydown task block (ms)', result.keydown),
    statsRow('input task block (ms)', result.input),
    statsRow('keyup task block (ms)', result.keyup),
    statsRow('keydown to painted frame (ms)', result.frame),
    ...(result.composition.count > 0
      ? [
          statsRow('composition task block (ms)', result.composition),
          statsRow('composition to painted frame (ms)', result.compositionFrame),
        ]
      : []),
    '',
    `Long tasks (>50ms): ${result.longTaskCount}`,
    '',
    `Main thread was busy ${formatMs(summary.activeMs)}ms of ${formatMs(summary.sampledMs)}ms ` +
      `sampled, of which ${formatMs(summary.unattributedMs)}ms sat in engine frames with no JS ` +
      `on the stack (layout, paint, compilation). Tables below rank the remaining ` +
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
    '| --- | --- | --- | --- |',
  ];

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

  lines.push('', `CPU profile: \`${result.profilePath}\``, '');
  return lines.join('\n');
};

test.describe('composer typing cost', () => {
  test.describe.configure({ mode: 'serial' });

  test('empty composer', async ({ page }) => {
    results.push(
      await measureTypingScenario(page, {
        name: 'empty-composer',
        description: 'Baseline. Typing into an empty composer with default settings.',
      })
    );
  });

  test('long message', async ({ page }) => {
    results.push(
      await measureTypingScenario(page, {
        name: 'long-message',
        description: `Composer pre-filled with ~${PREFILLED_CHARACTER_COUNT} characters across 6 blocks, then typed at the end. Isolates per-keystroke work that scales with document size.`,
        prefill: true,
      })
    );
  });

  test('long message with editor toolbar', async ({ page }) => {
    results.push(
      await measureTypingScenario(page, {
        name: 'long-message-toolbar',
        description:
          'Same as long message, with the editor toolbar enabled. Isolates the toolbar re-render cost.',
        settings: { editorToolbar: true, isMarkdownEnabled: true },
        prefill: true,
      })
    );
  });

  test('mention autocomplete open', async ({ page }) => {
    results.push(
      await measureTypingScenario(page, {
        name: 'autocomplete-open',
        description:
          'Typing with an active @ autocomplete query. Isolates the cost of re-rendering RoomInput on every keystroke.',
        openAutocomplete: true,
      })
    );
  });

  test('composition typing', async ({ page }) => {
    results.push(
      await measureTypingScenario(page, {
        name: 'composition',
        description:
          'Predictive/IME keyboard composing words via Input.imeSetComposition rather than discrete keystrokes. This is the mobile soft-keyboard path; the other scenarios never produce composition events.',
        useComposition: true,
      })
    );
  });

  test('composition typing beside inline code anchors', async ({ page }) => {
    results.push(
      await measureTypingScenario(page, {
        name: 'composition-inline-code',
        description:
          'Composition typing with inline code at both block boundaries, so ensureInlineBoundaryAnchors and stripDeadCaretAnchors actually mutate and reset the selection on each edit.',
        prefillInlineCode: true,
        useComposition: true,
      })
    );
  });

  test.afterAll(async () => {
    if (results.length === 0) return;
    const report = [
      '# Composer typing performance',
      '',
      `- CPU throttling: ${CPU_THROTTLING_RATE}x`,
      `- Viewport: Pixel 5`,
      `- Keystrokes measured per scenario: ${KEYSTROKE_COUNT} at ${KEYSTROKE_DELAY_MS}ms intervals`,
      `- Generated: ${new Date().toISOString()}`,
      '',
      'Measured against the Vite dev server, so React runs in development mode and absolute',
      'numbers are pessimistic. Use these figures to rank costs and to compare before/after a',
      'change, not as production latency.',
      '',
      ...results.map(renderScenario),
    ].join('\n');

    const reportPath = await saveReport(`${runFileName('typing')}.md`, report);
    process.stdout.write(`\nPerformance report: ${reportPath}\n`);
    process.stdout.write(`Profiles: ${PERFORMANCE_RESULTS_DIR}\n\n`);

    results.forEach((result) => {
      const isComposition = result.composition.count > 0;
      const frame = isComposition ? result.compositionFrame : result.frame;
      process.stdout.write(
        `${result.name.padEnd(26)} input p50 ${formatMs(result.input.p50Ms).padStart(6)}ms   ` +
          `${isComposition ? 'compose' : '  keyup'} p50 ` +
          `${formatMs(isComposition ? result.composition.p50Ms : result.keyup.p50Ms).padStart(
            6
          )}ms   ` +
          `frame p50 ${formatMs(frame.p50Ms).padStart(6)}ms   ` +
          `busy ${formatMs(result.summary.activeMs).padStart(7)}ms\n`
      );
    });
  });
});
