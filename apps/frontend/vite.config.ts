import fs from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import unoCss from 'unocss/vite';
import { type UserConfig, defineConfig, loadEnv, mergeConfig } from 'vite-plus';

import { getCommonTaskProps, getPackageViteConfig } from '../../vite.config.ts';
import { socialMeta } from './social-meta.ts';

const port = Math.trunc(Number(globalThis.process.env['ADMIN_PORT'] ?? '3001'));

export default defineConfig(({ mode }): UserConfig => {
  const dir = import.meta.dirname;
  const rootDir = path.resolve(dir, '../..');
  const commonTaskProps = getCommonTaskProps(rootDir, mode);
  const { ADMIN_URL: adminUrlEnv = '', VITE_ADMIN_URL: viteAdminUrlEnv = '' } = loadEnv(
    mode,
    rootDir,
    ['ADMIN_', 'VITE_ADMIN_'],
  );
  const adminUrl = adminUrlEnv.trim() === '' ? viteAdminUrlEnv : adminUrlEnv;

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
      build: {
        rolldownOptions: {
          external: [
            'child_process',
            'fs',
            'fs/promises',
            'path',
            'stream',
            'timers',
            'util',
            'zlib',
          ],
        },
      },
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
        socialMeta(adminUrl),
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
            cache: false,
            command: 'playwright test',
          },
          'wrangler:delete': {
            ...commonTaskProps,
            command: `wrangler delete`,
          },
          'wrangler:deploy': {
            ...commonTaskProps,
            command: `wrangler deploy`,
          },
          'wrangler:dev': {
            ...commonTaskProps,
            command: `wrangler dev --port ${port} --inspector-port 9231 --show-interactive-dev-session=false`,
          },
        },
      },
      server: {
        port,
      },
      test: {
        coverage: {
          exclude: ['**/index.ts', '**/main.tsx'],
          include: ['src/**/*.ts', 'src/**/*.tsx', 'social-meta.ts'],
        },
        environment: 'jsdom',
        globalSetup: ['tests/unit/helpers/global-setup.ts'],
        isolate: true,
        setupFiles: ['tests/unit/helpers/setup.ts'],
      },
    } satisfies UserConfig,
  );
});
