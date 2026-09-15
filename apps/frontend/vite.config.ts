import fs from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import unoCss from 'unocss/vite';
import { type UserConfig, defineConfig } from 'vite-plus';

import { getCommonRunProps, getPackageViteConfig } from '../../vite.config.ts';

const port = Math.trunc(Number(globalThis.process.env['ADMIN_PORT'] ?? '3001'));

export default defineConfig(({ mode }): UserConfig => {
  const dir = import.meta.dirname;

  const rootDir = path.resolve(dir, '../..');

  const commonRunProps = getCommonRunProps(rootDir, mode);

  const baseConfig = getPackageViteConfig({
    buildType: 'build',
    devCommand: 'vp dev',
    dir,
    excludeDevCommand: false,
    excludeStartCommand: false,
    mode,
    startCommand: 'vp preview',
  });

  const plugins = [
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
  ];

  return {
    ...baseConfig,
    build: {
      ...baseConfig.build,
      rolldownOptions: {
        ...baseConfig.build?.rolldownOptions,
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
    plugins,
    preview: {
      port,
    },
    resolve: {
      ...baseConfig.resolve,
      alias: {
        '@lightproject/backend': path.resolve(dir, '../../apps/backend/src/client.ts'),
        '@lightproject/common': path.resolve(dir, '../../packages/common/src'),
        '@lightproject/design-system': path.resolve(dir, '../../packages/design-system/src'),
      },
    },
    run: {
      ...baseConfig.run,
      tasks: {
        ...baseConfig.run?.tasks,
        'wrangler:delete': {
          command: `wrangler delete`,
          ...commonRunProps,
        },
        'wrangler:deploy': {
          command: `wrangler deploy`,
          ...commonRunProps,
        },
        'wrangler:dev': {
          command: `wrangler dev --port ${port} --inspector-port 9231 --show-interactive-dev-session=false`,
          ...commonRunProps,
        },
      },
    },
    server: {
      port,
    },
    test: {
      ...baseConfig.test,
      coverage: {
        ...baseConfig.test?.coverage,
        exclude: ['**/index.ts', '**/main.tsx'],
      },
      environment: 'jsdom',
      globalSetup: ['tests/helpers/global-setup.ts'],
      isolate: true,
    },
  };
});
