/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';
import { enableMapSet } from 'immer';

// Match production (src/index.tsx) — immer's Map/Set support is opt-in.
enableMapSet();

// jsdom doesn't implement canvas — mock it to suppress the warning
HTMLCanvasElement.prototype.getContext = vi.fn();

// jsdom doesn't implement IntersectionObserver — provide a no-op stub. The
// `as unknown as typeof IntersectionObserver` cast bridges the missing
// constructor signature so we don't need a decorative empty constructor here.
class MockIntersectionObserver {
  observe = vi.fn();

  unobserve = vi.fn();

  disconnect = vi.fn();
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

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
