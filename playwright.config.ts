import { defineConfig, devices } from '@playwright/test';

const IS_PRODUCTION_TARGET = process.env.E2E_TARGET === 'production';

const PORT = IS_PRODUCTION_TARGET ? 4173 : 8080;

export const BASE_URL = `http://localhost:${PORT}`;

const SEPARATELY_RUN_SPECS = ['**/performance/**', '**/desktop/**'];
const CALL_SPECS = '**/call/**';
const CALL_PROJECT_WORKERS = 2;

export default defineConfig({
  testDir: './e2e',
  testIgnore: SEPARATELY_RUN_SPECS,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: './e2e/globalSetup.ts',
  use: {
    baseURL: BASE_URL,
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: [...SEPARATELY_RUN_SPECS, CALL_SPECS],
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
      },
    },
    {
      name: 'chromium-call',
      testMatch: CALL_SPECS,
      workers: CALL_PROJECT_WORKERS,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--autoplay-policy=no-user-gesture-required',
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
          ],
        },
      },
    },
    {
      name: 'firefox',
      testIgnore: [...SEPARATELY_RUN_SPECS, CALL_SPECS],
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: { firefoxUserPrefs: { 'media.autoplay.default': 0 } },
      },
    },
  ],
  webServer: {
    command: IS_PRODUCTION_TARGET
      ? `npm run build && npx vite preview --port ${PORT} --strictPort`
      : 'npm start',
    url: BASE_URL,
    reuseExistingServer: !IS_PRODUCTION_TARGET && !process.env.CI,
    timeout: 120_000,
  },
});
