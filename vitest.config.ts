import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import fs from 'fs';
import path from 'path';

const nodeEnvironmentTests = 'src/app/utils/**/!(matrix|sessionLock).test.ts';

const { version: appVersion } = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));

export default defineConfig({
  plugins: [react(), vanillaExtractPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  test: {
    pool: 'threads',
    globals: true,
    css: true,
    silent: 'passed-only',
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [nodeEnvironmentTests],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'happy-dom',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}', `!${nodeEnvironmentTests}`],
        },
      },
    ],
  },
});
