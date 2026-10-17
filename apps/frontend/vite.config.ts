import fs from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import unoCss from 'unocss/vite';
import { type UserConfig, defineConfig, loadEnv, mergeConfig } from 'vite-plus';

import { getCommonTaskProps, getPackageViteConfig } from '../../vite.config.ts';
import { socialMeta } from './social-meta.ts';

const port = Math.trunc(Number(globalThis.process.env['FRONTEND_PORT'] ?? '2001'));
const inspectorPort = Math.trunc(
  Number(globalThis.process.env['FRONTEND_INSPECTOR_PORT'] ?? '8231'),
);

export default defineConfig(({ mode }): UserConfig => {
  const dir = import.meta.dirname;
  const rootDir = path.resolve(dir, '../..');
  const commonTaskProps = getCommonTaskProps(rootDir, mode);
  const { FRONTEND_URL: frontendUrlEnv = '', VITE_FRONTEND_URL: viteFrontendUrlEnv = '' } = loadEnv(
    mode,
    rootDir,
    ['FRONTEND_', 'VITE_FRONTEND_'],
  );
  const frontendUrl = frontendUrlEnv.trim() === '' ? viteFrontendUrlEnv : frontendUrlEnv;

  return mergeConfig(
    getPackageViteConfig({
      buildType: 'build',
      devCommand: 'vp dev',
      dir,
      excludeDevCommand: false,
      excludeStartCommand: false,
      mode,
      startCommand: 'vp preview',
    }),
    {
      plugins: [
        react(),
        unoCss({
          configDeps: fs
            .readdirSync(path.resolve(dir, '../../packages/design-system/src'), {
              recursive: true,
            })
            .map(String)
            .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
            .map((file) => path.resolve(dir, '../../packages/design-system/src', file)),
          configFile: path.resolve(dir, '../../packages/design-system/uno.config.ts'),
        }),
        socialMeta(frontendUrl),
      ],
      preview: {
        port,
      },
      resolve: {
        alias: {
          '@lightproject/backend': path.resolve(dir, '../../apps/backend/src/client.ts'),
          '@lightproject/common': path.resolve(dir, '../../packages/common/src'),
          '@lightproject/design-system': path.resolve(dir, '../../packages/design-system/src'),
        },
      },
      run: {
        tasks: {
          'test:e2e': {
            cache: {
              ...commonTaskProps.cache,
              output: [{ base: 'package', pattern: 'e2e-test-results/**/*' }],
            },
            command: 'playwright test',
          },
          'wrangler:delete': {
            cache: false,
            command: `wrangler delete`,
          },
          'wrangler:deploy': {
            cache: false,
            command: `wrangler deploy`,
          },
          'wrangler:dev': {
            cache: false,
            command: `wrangler dev --port ${port} --inspector-port ${inspectorPort} --show-interactive-dev-session=false`,
          },
        },
      },
      server: {
        port,
      },
      test: {
        coverage: {
          exclude: ['**/index.ts', '**/main.tsx'],
          include: ['social-meta.ts'],
        },
        env: { SKIP_OPENTELEMETRY: 'true' },
        environment: 'jsdom',
        globalSetup: ['tests/unit/helpers/global-setup.ts'],
        isolate: true,
        setupFiles: ['tests/unit/helpers/setup.ts'],
      },
    } satisfies UserConfig,
  );
});
