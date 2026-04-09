# Cinny — Matrix Chat Client

Cinny is a Matrix chat client built with React, TypeScript, and Vite.

## Quick Reference

| Command                | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `npm start`            | Dev server                                |
| `npm run build`        | Production build                          |
| `npm run lint`         | ESLint + Prettier check                   |
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

## Git Hooks

- **pre-commit** (Husky): runs `npx lint-staged && npm test`.
  - `lint-staged` lints only staged files (eslint on `*.{ts,tsx,js,jsx,cjs,mjs}`, prettier `--check` on everything else). Config lives in the `lint-staged` section of `package.json`.
  - Then `npm test` runs the full Vitest suite.
  - Lint errors or failing tests block the commit; lint warnings do not.

## Environment Variables

Vite env vars use `VITE_` prefix, accessed via `import.meta.env.VITE_*`:

- `VITE_GIF_SERVER_URL` — GIF search API endpoint
- `VITE_GIF_API_KEY` — GIF API key

## Key Patterns

- **Matrix client** is initialized in `src/client/` and provided via React context
- **Responsive breakpoints**: Desktop >1124px, Tablet >750px, Mobile <750px (see `useScreenSize` hook)
- **i18n**: translations in `public/locales/`, use `useTranslation()` hook
- **Virtualization**: long lists use `@tanstack/react-virtual`
- **Drag & drop**: uses `@atlaskit/pragmatic-drag-and-drop`
