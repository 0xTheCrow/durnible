# Durnible — Matrix Chat Client

Durnible is a Matrix chat client built with React, TypeScript, and Vite. Forked from Cinny.

## Quick Reference

| Command                | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `npm start`            | Dev server                                |
| `npm run build`        | Production build                          |
| `npm run lint`         | Prettier write, then ESLint check         |
| `npm run typecheck`    | TypeScript type checking (`tsc --noEmit`) |
| `npm test`             | Run tests (Vitest)                        |
| `npm run test:watch`   | Watch mode tests                          |
| `npm run fix:prettier` | Auto-format with Prettier                 |

## Tech Stack

- **React 18** with TypeScript (strict mode)
- **Vite** for bundling, **Vitest** for testing
- **matrix-js-sdk** for Matrix protocol
- **Jotai** for state management (atoms in `src/app/state/`)
- **Vanilla Extract** for CSS (`*.css.ts` files)
- **Slate** for the rich text message editor
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
- `src/app/plugins/` — Slate editor plugins (markdown, emoji, etc.)
- `src/app/utils/` — Utility functions
- `src/app/styles/` — Global styles
- `src/client/` — Matrix client initialization
- `src/types/` — Shared TypeScript types

## Code Conventions

- Follow the existing ESLint and Prettier configuration — don't disable rules inline, don't reformat against the configured style, and fix lint errors at the source rather than suppressing them.
- Functional components only, with typed props via TypeScript interfaces
- Named exports preferred over default exports for utilities
- Prettier: 100 char line width, single quotes
- ESLint extends airbnb + prettier + TypeScript rules
- `react-hooks/exhaustive-deps` is set to **error** — don't skip deps
- CSS is co-located as `*.css.ts` Vanilla Extract files (not CSS modules)
- Tests live alongside source as `*.test.ts` in `src/app/utils/`
- Don't use `useReducer` as a force-update hack (e.g., `const [, forceUpdate] = useReducer(n => n + 1, 0)`). If a component needs to re-render, it should be driven by real state or props changes.
- Don't patch matrix-js-sdk types with `as any` — find the correct type or fix the upstream typing.
- Don't use `setTimeout` to work around race conditions in room state — use the SDK's event listeners.
- Avoid `requestAnimationFrame` if possible — prefer CSS transitions/animations or React state-driven updates.
- No comments by default. Aim for code that reads on its own — clear names, obvious control flow. Only add a comment when something is genuinely unclear and can't be fixed by renaming or restructuring: a non-obvious invariant, a workaround for a specific bug, or behavior that would surprise a reader. Don't narrate what the code does, don't leave JSDoc on internal helpers, don't reference the current task or PR.
- Watch for reuse opportunities. Before writing a new helper, check whether an existing utility in `src/app/utils/`, hook in `src/app/hooks/`, or component already does the job. If you're writing something that looks like code elsewhere in the repo, stop and consolidate — extract a shared function rather than duplicating. When editing, flag nearby duplication you notice even if it's out of scope, and ask before refactoring.

## Testing

- When asked to write tests, propose the test cases first (what's being covered, at what level, with what assertions) and wait for approval before writing any code.
- Tests target the component's **expected behavior / contract**, not a snapshot of its current implementation. A refactor that preserves behavior should not require updating tests.
- Don't identify components in tests by matching on visible strings (button labels, body copy, translated text), ARIA roles alone, or DOM structure — those are brittle and will break on copy edits, i18n changes, or markup refactors. Add explicit `data-testid` props (or similar id props) to components and query by those. If the component you need to target lacks an id prop, add one as part of the test work.

## Git Hooks

- **pre-commit** (Husky): runs `npx lint-staged && npm test`.
  - `lint-staged` lints only staged files (eslint on `*.{ts,tsx,js,jsx,cjs,mjs}`, prettier `--check` on everything else). Config lives in the `lint-staged` section of `package.json`.
  - Then `npm test` runs the full Vitest suite.
  - Lint errors or failing tests block the commit; lint warnings do not.

## Environment Variables

Vite env vars use `VITE_` prefix, accessed via `import.meta.env.VITE_*`:

- `VITE_GIF_SERVER_URL` — GIF search API endpoint
- `VITE_GIF_API_KEY` — GIF API key

## Communication Style

- Answer plainly. No hyperbole, no stylistic flourishes, no marketing voice.
- Avoid intensifiers ("extremely", "incredibly", "massively"), superlatives ("the best", "the perfect"), and filler praise ("great question", "excellent point").
- Don't dramatize tradeoffs or risks — state them once, flatly.
- Don't editorialize about the code or the task ("this is a clever pattern", "this is gnarly"). Describe what it does.
- Prefer declarative sentences over rhetorical structure (no "Not X — Y", no tricolons for effect).
- Don't write short sentences that exist only for rhythm or punctuation. "Not ideal." "Worth flagging." "That's the tradeoff." If a sentence doesn't add information beyond what the surrounding text already says, delete it.
- Prefer precise technical explanations. Don't dumb things down, soften jargon, or add hand-holding analogies unless asked — assume the reader knows the stack.

## Disagreement and judgment

- Don't cave to pushback without re-examining. User disagreement, correction, or frustration is a signal to re-check the argument, not a verdict. If the user is right, update and say so. If they're wrong, explain why — don't agree to smooth things over.
- Evaluate the real problem, not the feeling about it. "This sounds like trouble" or "this is too complicated" isn't automatically correct. Sometimes the hard path is the right path; sometimes a plan the user approved is the wrong one, and it's your job to say so.
- Both parties are fallible. The user can misremember the codebase, be wrong about past decisions, or propose bad designs. You can hallucinate, misread code, or miss context. Disagreement is useful data — work the problem together, don't defer reflexively.

## Key Patterns

- **Matrix client** is initialized in `src/client/` and provided via React context
- **Responsive breakpoints**: Desktop >1124px, Tablet >750px, Mobile <750px (see `useScreenSize` hook)
- **i18n**: translations in `public/locales/`, use `useTranslation()` hook
- **Virtualization**: long lists use `@tanstack/react-virtual`
- **Drag & drop**: uses `@atlaskit/pragmatic-drag-and-drop`
