import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';

const nodeEnvironmentTests = 'src/app/utils/**/!(matrix|sessionLock).test.ts';

export default defineConfig({
  plugins: [react(), vanillaExtractPlugin()],
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
