import { cwd } from 'node:process';
import react from '@vitejs/plugin-react-swc';
import UnoCss from 'unocss/vite';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import tsconfig from 'vite-tsconfig-paths';

const isCi = process.env['CI'] === 'true';

const projectDir = cwd();

const sourcemap = !(isCi || process.env['DISABLE_VITE_SOURCEMAP'] === 'true');

const DEFAULT_PORT = 4000;

export default defineConfig({
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    outDir: 'out',
    sourcemap,
  },
  cacheDir: '.vite',
  define: {
    global: 'window',
  },
  plugins: [
    UnoCss({
      configFile: './uno.config.ts',
      mode: 'global',
    }),
    tsconfig({
      configNames: ['tsconfig.build.json'],
      root: projectDir,
    }),
    react(),
    nodePolyfills(),
  ],
  preview: {
    host: true,
    port: process.env['VITE_PORT'] ? Number(process.env['PORT']) : DEFAULT_PORT,
  },
  resolve: {
    alias: {
      buffer: 'rollup-plugin-node-polyfills/polyfills/buffer-es6',
    },
  },
  server: {
    host: true,
    port: process.env['VITE_PORT'] ? Number(process.env['PORT']) : DEFAULT_PORT,
  },
});
