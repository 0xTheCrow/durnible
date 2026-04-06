/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement canvas — mock it to suppress the warning
HTMLCanvasElement.prototype.getContext = vi.fn();

// jsdom doesn't implement IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(_cb: IntersectionObserverCallback) {}
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
  (import.meta as any).env.BASE_URL = '/';
}
