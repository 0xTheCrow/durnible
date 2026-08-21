import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import fs from 'fs';
import path from 'path';
import buildConfig from './build.config';

const isAnalyzeBuild = process.env.ANALYZE === 'true';

const copyFiles = {
  targets: [
    {
      src: 'config.json',
      dest: '',
    },
    {
      src: 'public/manifest.json',
      dest: '',
      rename: { stripBase: 1 },
    },
    {
      src: 'public/res/android',
      dest: '',
    },
    {
      src: 'public/locales',
      dest: '',
    },
  ],
};

function serverMatrixSdkCryptoWasm(wasmFilePath) {
  return {
    name: 'vite-plugin-serve-matrix-sdk-crypto-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === wasmFilePath) {
          const resolvedPath = path.join(
            path.resolve(),
            '/node_modules/@matrix-org/matrix-sdk-crypto-wasm/pkg/matrix_sdk_crypto_wasm_bg.wasm'
          );

          if (fs.existsSync(resolvedPath)) {
            res.setHeader('Content-Type', 'application/wasm');
            res.setHeader('Cache-Control', 'no-cache');

            const fileStream = fs.createReadStream(resolvedPath);
            fileStream.pipe(res);
          } else {
            res.writeHead(404);
            res.end('File not found');
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  appType: 'spa',
  publicDir: false,
  base: buildConfig.base,
  define: {
    global: 'globalThis',
  },
  server: {
    port: 8080,
    host: true,
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..'],
    },
  },
  plugins: [
    serverMatrixSdkCryptoWasm('/node_modules/.vite/deps/pkg/matrix_sdk_crypto_wasm_bg.wasm'),
    viteStaticCopy(copyFiles),
    vanillaExtractPlugin({ identifiers: 'debug' }),
    react(),
    isAnalyzeBuild &&
      visualizer({
        gzipSize: true,
        template: 'treemap',
        filename: 'dist/bundle-visualizer.html',
      }),
    VitePWA({
      srcDir: 'src',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
    copyPublicDir: false,
    rollupOptions: {
      inject: { Buffer: ['buffer', 'Buffer'] },
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/livekit-client') ||
            id.includes('/src/app/features/call/') ||
            id.includes('/src/app/hooks/call/') ||
            id.includes('/src/app/plugins/call/')
          ) {
            return 'call';
          }
          return undefined;
        },
      },
    },
  },
});
