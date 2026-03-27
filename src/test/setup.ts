/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';

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
