import { defineConfig, devices } from '@playwright/test';

const IS_PRODUCTION_TARGET = process.env.PERFORMANCE_TARGET === 'production';

const PORT = IS_PRODUCTION_TARGET ? 4173 : 8080;

export const PERFORMANCE_BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e/performance',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  reporter: [['list']],
  use: {
    baseURL: PERFORMANCE_BASE_URL,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: IS_PRODUCTION_TARGET
      ? `npm run build && npx vite preview --port ${PORT} --strictPort`
      : 'npm start',
    url: PERFORMANCE_BASE_URL,
    reuseExistingServer: !IS_PRODUCTION_TARGET,
    timeout: 300_000,
  },
});
