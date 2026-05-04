/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';
import { enableMapSet } from 'immer';

// Match production (src/index.tsx) — immer's Map/Set support is opt-in.
enableMapSet();

// jsdom doesn't implement canvas — mock it to suppress the warning
HTMLCanvasElement.prototype.getContext = vi.fn();

// jsdom doesn't implement IntersectionObserver / ResizeObserver — provide
// no-op stubs. The `as unknown as typeof X` cast bridges the missing
// constructor signature so we don't need a decorative empty constructor here.
class MockObserver {
  observe = vi.fn();

  unobserve = vi.fn();

  disconnect = vi.fn();
}
global.IntersectionObserver = MockObserver as unknown as typeof IntersectionObserver;
global.ResizeObserver = MockObserver as unknown as typeof ResizeObserver;

// Mock SVG imports
vi.mock('../../../../public/res/svg/cinny.svg', () => ({ default: 'cinny.svg' }));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// Provide a minimal import.meta.env
if (!import.meta.env.BASE_URL) {
  (import.meta.env as Record<string, unknown>).BASE_URL = '/';
}
