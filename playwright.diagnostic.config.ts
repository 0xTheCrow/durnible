import { defineConfig } from '@playwright/test';
import mainConfig from './playwright.config';

export default defineConfig({
  ...mainConfig,
  testDir: './e2e/diagnostic',
  testIgnore: [],
});
