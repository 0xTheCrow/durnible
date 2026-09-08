import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/desktop',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  reporter: [['list']],
  use: {
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
});
