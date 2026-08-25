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
| `npm run performance`   | Composer typing benchmark (chromium only; not part of `e2e`)    |

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
- Docs (AGENTS.md included) describe how things are, not how they were. When something changes, rewrite the text to match and delete what it replaced — no corrections, before/after framing, changelog entries, or "Done — X" sections. Why it changed belongs in the commit message or PR.
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

## Performance Benchmarking

Composer typing benchmark in `e2e/performance/`, excluded from the normal suite so CI never runs it.
Writes a markdown report and per-scenario `.cpuprofile` files to `performance-results/` (gitignored).

| Command                          | Purpose                                                     |
| -------------------------------- | ----------------------------------------------------------- |
| `npm run performance`            | Run against the dev server                                  |
| `npm run performance:production` | Build and measure the real bundle (attribution is minified) |
| `npm run performance:trace`      | Add renderer phases; inflates `busy` ~27%                   |

| Env var                      | Default | Purpose                                                            |
| ---------------------------- | ------- | ------------------------------------------------------------------ |
| `PERFORMANCE_REPETITIONS`    | `1`     | Repeat every scenario N times, interleaved; report shows the range |
| `PERFORMANCE_KEYSTROKES`     | `60`    | Keystrokes per scenario; use 150+ for anything conclusive          |
| `PERFORMANCE_CPU_THROTTLING` | `4`     | CDP CPU throttle (4x ≈ mid-tier mobile)                            |
| `PERFORMANCE_LABEL`          | —       | Suffixes output filenames so runs don't clobber each other         |
| `PERFORMANCE_ROOM_MESSAGES`  | `300`   | Messages seeded for the `busy-room` scenario                       |
| `PERFORMANCE_TRACE`          | —       | `1` enables renderer tracing                                       |
| `PERFORMANCE_TARGET`         | —       | `production` builds and serves via `vite preview`                  |

Rank on `busy` (total main-thread work) — it is far more reproducible than p50. Run with
`PERFORMANCE_REPETITIONS=3` and treat scenarios whose ranges overlap as indistinguishable. When
comparing two versions, label both runs and run them in the same session.

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

The metric is the **eager set**: the entry `<script>` plus every `<link rel="modulepreload">` in `dist/index.html`. That is what the browser fetches before the app can render. A shrinking `index.js` proves nothing — a `manualChunks` rule can move code into a separate file the entry still statically imports, leaving it eagerly preloaded. After every change, check that `dist/index.html` no longer preloads the chunk you split out, and that the build prints no `INEFFECTIVE_DYNAMIC_IMPORT` (that warning means a `React.lazy` body is also statically imported, usually through a barrel `index.ts`, and will not move).

`npm run build:analyze` shows chunk sizes but not whether a chunk is eager, so it cannot confirm a split. Two earlier entries here claimed wins that had not happened because they tracked entry-chunk size alone.

### Rules

- A `React.lazy` body must not be statically imported anywhere else, or it will not move. Keep heavy bodies out of feature `index.ts` barrels and import concrete paths.
- **`Suspense` goes above the modal, never inside it.** `OverlayModal` renders `FocusTrap`, whose `componentDidMount` calls `activate()` synchronously and throws when the container holds no tabbable node. A `fallback={null}` inside the modal commits an empty modal, and that throw escapes to the React root, which has no error boundary, unmounting the whole tree. `initialFocus: false` does not prevent it.
- **No `manualChunks` for app code.** Rolldown pulls a matched module's shared dependencies into the named chunk. Naming a feature directory produced a 1.2 MB chunk of 65 shared app modules that the entry then statically imported. Reserve it for large `node_modules` packages reachable only from a lazy path.
- **Stylesheet order is the cascade.** Vanilla Extract emits single-class rules, so equal-specificity ties go to whichever stylesheet loads first, and chunking decides that — rolldown's automatic shared-chunk extraction relocates CSS with no `manualChunks` rule involved. `src/index.css` puts folds in `@layer folds` so unlayered app CSS wins regardless of order; app-vs-app ties are unprotected. `cssCodeSplit: false` does not help, and chunking `.css.ts` together is worse.
- A chunk far under estimate usually means another importer is still pinning the shared code eager.

### Conditional

- **Route splitting** in `Router.tsx` — real yield unknown and probably low; measure before committing to it. `components/create-room` is pinned eager by `hooks/useCommands.ts`.
- **Auth vs client split** — removing auth from the logged-in bundle (`pages/auth` + `oidc-client-ts`) is ~18 kB gzip; removing the client from the logged-out bundle is ~700 kB, but only for visitors on the login page.
- **`sanitize-html` + `postcss`** — ~17 kB. Removal, not deferral: it sits on the timeline render path via `utils/sanitize.ts`.

### Not candidates

Verified eager and immovable: `chroma-js` (timeline power tags), `react-range` (`AudioPlayer`), `ua-parser-js` (`src/index.tsx`), `entities`/`htmlparser2` (message HTML), `i18next`, `@remix-run/router`, plus `matrix-js-sdk`/`react-dom`/`folds` and the timeline and composer directories.

## folds (UI library)

`folds` 2.4.0, Apache-2.0, `github.com/cinnyapp/folds`, by the Cinny author. Came with the fork.

It is the project's design vocabulary, not a swappable component dependency: 425 files, 52 symbols, ~2,600 bindings. `config`/`color`/`toRem` alone account for 446 imports, referenced inside co-located `*.css.ts` files, and `lightTheme`/`varsClass`/`configClass` drive `ThemeManager`. Anything replacing it must reproduce the token API or every stylesheet in the repo changes.

### Size facts

119 kB minified in the eager set, all of it folds' own code. `"dependencies": {}`, and its bundle externalizes `classnames`, `react`, `react-dom`, and `react/jsx-runtime` — all peers the app already ships, so there is no dedup win to find.

It publishes only `dist`: one pre-bundled `index.js` plus a 46 kB `style.css`. `src/index.css` blanket-imports that stylesheet, so all 46 kB ships regardless of which components are used, 36% of `index.css`. Vanilla Extract compiled it at folds' publish time, so this build cannot split it per component.

Peer pins are stale and install only because `.npmrc` sets `legacy-peer-deps=true`: it wants `@vanilla-extract/css` 1.9.2 (installed 1.20.1), `recipes` 0.3.0 (0.5.7), `react`/`react-dom` 17.0.0 (18.2.0). Inert today, but it has not been updated for React 18.

### TODO — vendor the source

Copy the folds repo's `src/` — not `node_modules/folds/dist`, which ships no sources — to `src/app/folds/`; alias `folds` to that path in `compilerOptions.paths` and `resolve.alias`, neither of which exists today; drop the dependency; and delete the `folds/dist/style.css` `@import` from `src/index.css` so styles compile through this project's Vanilla Extract pipeline. All 425 call sites keep `from 'folds'` unchanged, and it reverts by reinstalling the package.

**Probe first:** clone, alias, then `npm run typecheck` and `npm run build`. The VE 1.9 → 1.20 and recipes 0.3 → 0.5 spans include breaking theme and recipe API changes, and whether the source compiles is the gate on the whole plan.

Costs: add the vendored tree to `ignorePatterns` in `.eslintrc.cjs` rather than reworking someone else's code to these conventions, and carry the Apache-2.0 `LICENSE` and notices with it. Win: per-component CSS emission (~10-15 kB gzip), plus freedom to fix, extend, and adapt to React 18/19 in-house.

**Do not rewrite it from scratch.** Hand-rolled equivalents are the same widgets and land in the same ~34 kB gzip, so the realistic saving is ~1.5% of the eager set against a 425-file refactor with no visual regression testing. Replace individual components behind the same import surface after vendoring, if it is still worth it then.
