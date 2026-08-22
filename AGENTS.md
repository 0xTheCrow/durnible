# Durnible — Matrix Chat Client

Durnible is a Matrix chat client built with React, TypeScript, and Vite. Forked from Cinny.

## Quick Reference

| Command                 | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `npm start`             | Dev server                                                      |
| `npm run build`         | Production build                                                |
| `npm run build:analyze` | Build + emit bundle treemap (`dist/bundle-visualizer.html`)     |
| `npm run lint`          | Prettier write, then ESLint check                               |
| `npm run typecheck`     | TypeScript type checking (`tsc --noEmit`)                       |
| `npm test`              | Run tests (Vitest)                                              |
| `npm run test:watch`    | Watch mode tests                                                |
| `npm run e2e`           | Run Playwright e2e (auto-starts dev server; chromium + firefox) |
| `npm run fix:prettier`  | Auto-format with Prettier                                       |

## Tech Stack

- **React 18** with TypeScript (strict mode)
- **Vite** for bundling, **Vitest** for testing
- **matrix-js-sdk** for Matrix protocol
- **Jotai** for state management (atoms in `src/app/state/`)
- **Vanilla Extract** for CSS (`*.css.ts` files)
- **Folds** — custom UI component library
- **React Aria** for accessibility
- **TanStack React Query** for async data
- **react-i18next** for internationalization (translation files in `public/locales/`)

## Project Structure

- `src/app/components/` — Reusable UI components
- `src/app/features/` — Feature modules (settings, room, space, etc.)
- `src/app/pages/` — Page-level components (App, Auth, Client)
- `src/app/state/` — Jotai atoms and state logic
- `src/app/hooks/` — Custom React hooks
- `src/app/plugins/` — Domain modules and third-party library wrappers (emoji, custom-emoji image packs, markdown parsing, matrix.to URL handling, HTML parsing/rendering, PDF, syntax highlighting, text-area helpers, etc.)
- `src/app/utils/` — Utility functions
- `src/app/styles/` — Global styles
- `src/client/` — Matrix client initialization
- `src/types/` — Shared TypeScript types

## Code Conventions

- Follow the existing ESLint and Prettier configuration — don't disable rules inline, don't reformat against the configured style, and fix lint errors at the source rather than suppressing them.
- Functional components only, with typed props via TypeScript interfaces
- `useState` setters follow the `set[Name]` convention — e.g. `const [count, setCount]`, never `const [count, updateCount]` or `const [selected, selectItem]`. Rename violations when editing nearby code.
- Named exports preferred over default exports for utilities
- Don't abbreviate identifiers. Spell names out in full unless the abbreviation is the canonical term (a Web/DOM API name like `rect` from `getBoundingClientRect`, a math notation like `dx`/`dy`, a widely understood unit like `id`, or a loop counter like `i`). Avoid `el` for `element`, `scrollEl` for `scrollElement`, `sRect` for `scrollRect`, `ro` for `resizeObserver`, `io` for `intersectionObserver`, `max` for `maxScrollTop`, `top` for `targetScrollTop`, etc. Readability over keystrokes — if the name describes what the value is, don't shorten it.
- Prettier: 100 char line width, single quotes
- ESLint extends airbnb + prettier + TypeScript rules
- `react-hooks/exhaustive-deps` is set to **error** — don't skip deps
- CSS is co-located as `*.css.ts` Vanilla Extract files (not CSS modules)
- Tests live alongside source as `*.test.ts` in `src/app/utils/`
- Don't use `useReducer` as a force-update hack (e.g., `const [, forceUpdate] = useReducer(n => n + 1, 0)`). If a component needs to re-render, it should be driven by real state or props changes.
- Don't write `useEffect` just to mirror local state. Litmus test: if the effect's `setState` value depends only on values already readable during render (props, state, React context) — no new subscription, no async, no DOM read — delete the effect. Effects that call `setState` inside an event-listener callback, after an `await`, or after measuring the DOM are legitimate; the rule targets effect bodies whose outcome is purely derived from existing inputs. Writes to shared state (Jotai atoms, context, external stores) that trigger re-renders in other components are cross-component side effects and belong in effects even when all input values are available during render. Two fixes for local state mirroring, depending on the case: (1) if the state is always derivable from props (e.g. `setFiltered(list.filter(...))` on `[list]`), delete the state and derive inline — `const filtered = list.filter(...)` — wrapping with `useMemo` only if the derivation is measurably expensive. (2) If local state must reset when a prop changes, use the setState-during-render pattern shown below, not an effect; prefer a component `key=` only if resetting the entire subtree is acceptable, since `key` remounts and loses focus, scroll, and input selection.
  ```tsx
  const [value, setValue] = useState(propValue);
  const [prev, setPrev] = useState(propValue);
  if (propValue !== prev) {
    setPrev(propValue);
    setValue(propValue);
  }
  ```
- Use `useCallback` and `useMemo` the way React is designed to have them used. Both preserve reference identity for a downstream consumer that actually depends on it — a hook dep array that would otherwise re-fire, a `React.memo`-wrapped child that would otherwise re-render, an external API that requires stable refs. `useMemo` additionally caches the result of a computation, which is worth reaching for only when the computation is _measurably_ expensive. Neither is a default, and neither is a style to apply uniformly. If nothing downstream reads the identity and the computation isn't expensive, the wrapper allocates and adds noise without benefit. Before reaching for either, name the specific consumer that needs stable identity or the specific expensive computation being saved; if you can't, inline. Mixing wrapped and inline handlers within the same component is the tell — either every wrap is load-bearing for its own reason, or none of them are.
- Don't patch matrix-js-sdk types with `as any` — find the correct type or fix the upstream typing.
- Don't use `setTimeout` to work around race conditions in room state — use the SDK's event listeners.
- Avoid `requestAnimationFrame` if possible — prefer CSS transitions/animations or React state-driven updates.
- No comments by default. Aim for code that reads on its own — clear names, obvious control flow. Only add a comment when something is genuinely unclear and can't be fixed by renaming or restructuring: a non-obvious invariant, a workaround for a specific bug, or behavior that would surprise a reader. Don't narrate what the code does, don't leave JSDoc on internal helpers, don't reference the current task or PR.
- Watch for reuse opportunities. Before writing a new helper, check whether an existing utility in `src/app/utils/`, hook in `src/app/hooks/`, or component already does the job. If you're writing something that looks like code elsewhere in the repo, stop and consolidate — extract a shared function rather than duplicating. When editing, flag nearby duplication you notice even if it's out of scope, and ask before refactoring.
- This project uses vite 8 / Rolldown, which resolves CJS default imports by Node semantics (`import x from 'pkg'` yields `module.exports`, ignoring a runtime `__esModule`+`exports.default`). A bare-CJS package (no `exports`/`module` field in its `package.json`) that's TS-compiled with `exports.default` will break on a default import — `x` becomes the module object, not the function. Import the **named** export instead (`import { thing } from 'pkg'`), or read `.default` explicitly. This bit `millify` (fixed in `src/app/plugins/millify.ts`).

## Testing

- When asked to write tests, propose the test cases first (what's being covered, at what level, with what assertions) and wait for approval before writing any code.
- Before proposing, do a pruning pass over the cases you brainstormed and drop the trivial ones rather than presenting the raw list. A case is trivial if it asserts something the type system, the runtime/platform, or an existing test already guarantees — e.g. a test whose code path has no special-casing for the input it varies (so it only exercises a DOM/stdlib primitive), or two cases that cover the same branch through cosmetically different inputs (collapse them). Propose the lean set, and if a cut is debatable, name what you dropped and why so the user can pull it back.
- Tests target the component's **expected behavior / contract**, not a snapshot of its current implementation. A refactor that preserves behavior should not require updating tests.
- Don't identify components in tests by matching on visible strings (button labels, body copy, translated text), ARIA roles alone, or DOM structure — those are brittle and will break on copy edits, i18n changes, or markup refactors. Add explicit `data-testid` props (or similar id props) to components and query by those. If the component you need to target lacks an id prop, add one as part of the test work.
- Don't hardcode values in tests that are defined as constants in source. If the test needs a value that depends on a source constant — a timeout, a cap, a threshold, a mime type, an event type, a URL path — import that constant and reference it (or derive from it, e.g. `WINDOW_MS / 2`). If the value isn't currently exported but is useful in a test, make it exportable first rather than copying the literal over. Copy-pasted literals desync silently when the source constant is retuned: the test either passes with stale semantics or fails in a way that looks like a regression when it isn't.
- Don't write tests that only verify behavior the type system already guarantees (e.g., that a function compares the correct fields on a typed object). Focus test effort on behavior types can't catch: state transitions, async sequencing, side effects, edge cases in runtime logic.
- Never write a test that passes while the behavior it covers is broken. If a behavior is misbehaving, its test must fail — that is the entire point of the test. Don't reach for expected-failure markers (Playwright's `test.fail()`), skips, or inverted assertions to keep a suite green around a known defect, and don't weaken an assertion until it stops failing. A green run has to mean the behavior works; the moment it can mean "works, or is broken in a way we wrote down," the suite stops being a signal and starts being noise. A real defect gets a genuinely failing test that stays red until it's fixed.

## Git

- The user is the only one who commits to this repo. No one and nothing else commits on their behalf — not you, not a script, not a hook. Never run `git commit` (or `git push`, `git reset --hard`, or any other history-rewriting or publishing command). The user owns every commit and reviews the diff before recording it. Stage work if asked, but stop before `commit`. This holds even when tests and lint pass, and even when an earlier plan appeared to include a commit step.

## Git Hooks

- **pre-commit** (Husky): runs `npx lint-staged && npm test`.
  - `lint-staged` lints only staged files (eslint on `*.{ts,tsx,js,jsx,cjs,mjs}`, prettier `--check` on everything else). Config lives in the `lint-staged` section of `package.json`.
  - Then `npm test` runs the full Vitest suite.
  - Lint errors or failing tests block the commit; lint warnings do not.

## Environment Variables

Vite env vars use `VITE_` prefix, accessed via `import.meta.env.VITE_*`:

- `VITE_GIF_SERVER_URL` — GIF server base URL. Auth is per-user via Matrix OpenID token exchange (`POST /auth/matrix` → bearer JWT, re-minted on expiry/401); there is no API key.

## Communication Style

- Answer plainly. No hyperbole, no stylistic flourishes, no marketing voice.
- Avoid intensifiers ("extremely", "incredibly", "massively"), superlatives ("the best", "the perfect"), and filler praise ("great question", "excellent point").
- Don't dramatize tradeoffs or risks — state them once, flatly.
- Don't editorialize about the code or the task ("this is a clever pattern", "this is gnarly"). Describe what it does.
- Prefer declarative sentences over rhetorical structure (no "Not X — Y", no tricolons for effect).
- Don't write short sentences that exist only for rhythm or punctuation. "Not ideal." "Worth flagging." "That's the tradeoff." If a sentence doesn't add information beyond what the surrounding text already says, delete it.
- Prefer precise technical explanations. Don't dumb things down, soften jargon, or add hand-holding analogies unless asked — assume the reader knows the stack.
- Answer questions asked mid-task in the turn's final message. Text emitted between tool calls may never be displayed, so an answer that lives only there reads as the question being ignored. Answer when asked, then restate the answer in the message that ends the turn.

## Disagreement and judgment

- Don't cave to pushback without re-examining. User disagreement, correction, or frustration is a signal to re-check the argument, not a verdict. If the user is right, update and say so. If they're wrong, explain why — don't agree to smooth things over.
- Evaluate the real problem, not the feeling about it. "This sounds like trouble" or "this is too complicated" isn't automatically correct. Sometimes the hard path is the right path; sometimes a plan the user approved is the wrong one, and it's your job to say so.
- Both parties are fallible. The user can misremember the codebase, be wrong about past decisions, or propose bad designs. You can hallucinate, misread code, or miss context. Disagreement is useful data — work the problem together, don't defer reflexively.

## Key Patterns

- **Matrix client** is initialized in `src/client/` and provided via React context
- **Responsive breakpoints**: Desktop >1124px, Tablet >850px, Mobile ≤850px. Values live in `src/app/styles/breakpoints.ts` and are shared by the `useScreenSize` hook and the `MOBILE_MEDIA_QUERY` used in `*.css.ts` media queries — don't hardcode the pixel value.
- **i18n**: translations in `public/locales/`, use `useTranslation()` hook
- **Virtualization**: long lists use `@tanstack/react-virtual`
- **Drag & drop**: uses `@atlaskit/pragmatic-drag-and-drop`

## Lazy Loading

Build-time lazy-loading work on the main bundle.

### How to verify a split landed

The metric is the **eager set**: the entry `<script>` plus every `<link rel="modulepreload">` in `dist/index.html`. That is what the browser fetches before the app can render. A shrinking `index.js` proves nothing on its own — a `manualChunks` rule can move code into a separate file that the entry still statically imports, leaving it eagerly preloaded. Check two things after every change:

- `dist/index.html` — the modulepreload list must not contain the chunk you just split out.
- Build output — no `INEFFECTIVE_DYNAMIC_IMPORT` warnings. That warning means a `React.lazy` body is also statically imported somewhere (usually a barrel `index.ts`) and will not move to its own chunk.

`npm run build:analyze` reports chunk sizes but not whether a chunk is eager, so it cannot confirm a split landed. Two earlier entries in this section claimed wins that had not happened because they tracked entry-chunk size alone.

### Done — call / livekit split

- livekit and the call UI now load on demand. Eager set 1,064 → 938.7 kB gzip (−125 kB). The `livekit` chunk is 118 kB gzip; `CallBar`, `CallPane`, `CallScreen`, `CallEngineMount`, `CallConnection`, and `CallEncryptionDebugPanel` are separate on-demand chunks.
- Mechanism: thin `CallProvider` (livekit-free) + `React.lazy` gates in `src/app/features/call/CallMounts.tsx` (`CallBarGate`/`CallScreenGate`/`CallPaneGate`), a lazy `CallEngineMount` that publishes participant state into `activeCallParticipantEntriesAtom`, and `useCallParticipantStates` reading that atom. `useCallLifecycle` was deleted.
- The split only landed once the barrel was severed. `features/call/index.ts` re-exports every call module, and `Router.tsx`, `RoomView.tsx`, and `RoomViewHeader.tsx` all imported through it, which made `CallBar`/`CallPane`/`CallScreen` statically reachable from the entry. All three now import concrete paths. Do not import from `features/call` — the barrel still re-exports the heavy bodies and will re-break this.
- `manualChunks` in `vite.config.js` matches `node_modules/livekit-client` only. An earlier version also matched `src/app/features/call/`, `hooks/call/`, and `plugins/call/`, which swept the eagerly-rendered `CallProvider` and `CallMounts` into the same chunk as livekit and made the entire chunk a static dependency of the entry.
- Entry-present call surfaces (room nav/header) must not import livekit — read the Jotai atoms instead.
- Before merging, manually verify the live voice-call flow (join/leave, mute/deafen, screenshare). Not covered by the e2e suite.

### Done — modal renderer split

- `reaction-viewer` (1.3 kB gzip) and `RoomSettings` (2.4 kB gzip) load on first open. The renderer wrappers stay eager, reading state and rendering `null` until opened.
- The chunks are small because both components are built almost entirely from modules the timeline already loads — message layouts, avatars, emoji, virtualizer. Only their own unique code moves. Splitting a leaf that shares its dependency tree with the shell buys little no matter how it is chunked.
- A `React.lazy` body must not be statically imported elsewhere. `features/room-settings/index.ts` re-exported `RoomSettings` and `Router.tsx` imported the renderer from that barrel, producing an `INEFFECTIVE_DYNAMIC_IMPORT`. Fix: import the renderer from its own file, and keep the heavy body out of the feature index.
- `Suspense` goes **above** the modal, never inside it. `OverlayModal` renders `FocusTrap`, whose `componentDidMount` calls `activate()` synchronously; `activate()` throws "must have at least one container with at least one tabbable node" when the container holds no tabbable node. A `Suspense fallback={null}` placed inside the modal commits an empty modal on the first render, and that throw escapes to the React root, which has no error boundary above it, unmounting the whole tree. `initialFocus: false` does not prevent this — it only short-circuits `getInitialFocusNode`.
- Moved `createRoomEncryptionState` out of `components/create-room` into its own `encryption.ts`, so the always-visible composer (`useCommands` `/startdm`) stops dragging the create-room UI into the entry.

### Do not use manualChunks for app code

Rolldown's `manualChunks` pulls a matched module's shared dependencies into the named chunk as well. Naming `src/app/features/room/reaction-viewer/` produced a 1.2 MB chunk holding 65 app modules (`react-custom-html-parser`, `plugins/emoji`, all of `components/message/layout/*`), which the entry then statically imported — so nothing was deferred and 1.2 MB was added to the preload list. It also moved shared component CSS into stylesheets that load before `index.css`, changing vanilla-extract's emission order and breaking equal-specificity rules across the app.

Plain dynamic `import()` with no rule at all produced correct 2.7 kB and 7.6 kB chunks. Reserve `manualChunks` for large `node_modules` packages reachable only from a lazy path.

### Backlog (not yet done, rough priority order)

- **Emoji data** — 829 kB minified, 23% of the eager set and its largest single item. Move `plugins/emoji.ts`'s data arrays (`emojis`, `emojiGroups`) into a lazy `emoji-data.ts` loaded via a cached Promise fired at boot (`await loadUnicodeEmoji()`). Keep the pure functions (`getShortcodeFor`, `getHexcodeForEmoji`, `buildShortcodeMap`) and the shortcode dicts (joypixels/emojibase) eager — the latter paint existing reactions on the visible timeline. `recent-emoji.ts` and `favorite-emoji.ts` `.find()` over `emojis` and point at the lazy data too.
- **Route-level splitting** in `src/app/pages/Router.tsx` — ~790 kB minified across `features`/`components`/`pages`. Lazily load `Room`, `Explore`/`Featured`/`PublicRooms`, `Inbox`/`Notifications`/`Invites`, `Create`, `Direct`, `Space`. Caveat from the create-probe: `pages/client/create` is only a ~4 kB wrapper and the real create graph is `components/create-room`, shared with the eager composer, so route-gating alone moves little until that path is broken (mostly done via `encryption.ts`).
- **Image cropper** — 84 kB minified. `react-advanced-cropper` and `advanced-cropper` are imported only by `components/image-editor/ImageEditor.tsx`, a modal-only surface. An isolated leaf, so unlike the modal bodies above it should actually move.
- **sanitize-html** — 76 kB minified including the 27 `postcss` modules it pulls in for style-attribute parsing. It sits on the timeline render path via `utils/sanitize.ts` so it cannot be deferred; a lighter sanitizer would drop postcss from the browser entirely.
- **Auth vs client split** — a logged-out visitor downloads the whole client. Splitting `Login`/`Register`/`ResetPassword` from the client shell also removes `oidc-client-ts` (35 kB minified) from the eager set.

### Baseline (measured 2026-08-22)

Eager set = entry + modulepreloads listed in `dist/index.html`.

- Eager total: **938.7 kB gzip** / 3,652 kB raw, across 10 chunks
- Deferred total: 482.8 kB gzip, across 17 chunks
- Largest deferred chunks: `ReactPrism` 204 kB, `livekit` 118 kB, `pdf` 94 kB, `rust-crypto` 43 kB gzip
- Eager composition, minified pre-gzip (compression ratios vary by content, so these are not transfer shares): emojibase 829 kB, matrix-js-sdk 644 kB, `src/app/features` 380 kB, `src/app/components` 287 kB, react-dom 126 kB, `src/app/pages` 124 kB, folds 116 kB, matrix-widget-api 102 kB, advanced-cropper 84 kB, sanitize-html + postcss 76 kB
- Service worker precaches 34 js/css/html entries, 5.37 MB raw / ~1.47 MB gzip, downloaded at SW install rather than on interaction. `matrix_sdk_crypto_wasm_bg.wasm` (5.32 MB) and `pdf.worker.min.mjs` (1.31 MB) are excluded because `globPatterns` in `vite.config.js` lists only `js,css,html`.
- Gzip figures come from `zlib.gzipSync` defaults and differ slightly from vite's reporter column. Do not mix the two sources in a comparison.
