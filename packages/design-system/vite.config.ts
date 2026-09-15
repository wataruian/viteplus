import fs from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import unoCss from 'unocss/vite';
import { type UserConfig, defineConfig } from 'vite-plus';

import { getCommonRunProps, getPackageViteConfig } from '../../vite.config.ts';

const designSystemPort = Math.trunc(Number(globalThis.process.env['DESIGN_SYSTEM_PORT'] ?? '6007'));

export default defineConfig(({ mode }): UserConfig => {
  const dir = import.meta.dirname;

  const rootDir = path.resolve(dir, '../..');

  const commonRunProps = getCommonRunProps(rootDir, mode);

  const baseConfig = getPackageViteConfig({
    buildCommand:
      'tsx --conditions=typescript ./src/utils/update-stories.ts && tsx --conditions=typescript ./src/utils/compile.ts && vp pack && vp build && storybook build',
    buildType: 'custom',
    devCommand: 'tsx watch --conditions=typescript ./src/start.ts false false',
    dir,
    excludeDevCommand: false,
    excludeStartCommand: false,
    mode,
    startCommand: 'tsx watch --conditions=typescript ./src/start.ts true false',
  });

  const basePack = baseConfig.pack && !Array.isArray(baseConfig.pack) ? baseConfig.pack : {};

  const plugins = [
    react(),
    unoCss({
      configDeps: fs
        .readdirSync(path.resolve(dir, './src'), {
          recursive: true,
        })
        .map(String)
        .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
        .map((file) => path.resolve(dir, './src', file)),
      configFile: path.resolve(dir, './uno.config.ts'),
    }),
  ];

  Object.assign(baseConfig, {
    ...baseConfig,
    build: {
      ...baseConfig.build,
      outDir: 'out',
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
    pack: {
      ...basePack,
      deps: {
        neverBundle: ['typescript'],
      },
      entry: [
        ...(Array.isArray(basePack.entry) ? basePack.entry : []),
        '!src/app.tsx',
        '!src/main.tsx',
        '!src/start.ts',
        '!.storybook/main.ts',
        '!.storybook/preview.tsx',
      ],
    },
    plugins,
    preview: {
      port: designSystemPort,
    },
    resolve: {
      ...baseConfig.resolve,
    },
    run: {
      ...baseConfig.run,
      tasks: {
        ...baseConfig.run?.tasks,
        'wrangler:delete': {
          command:
            'wrangler delete --config wrangler.design-system.toml && wrangler delete --config wrangler.storybook.toml',
          ...commonRunProps,
        },
        'wrangler:deploy': {
          command:
            'wrangler deploy --config wrangler.design-system.toml && wrangler deploy --config wrangler.storybook.toml',
          ...commonRunProps,
        },
        'wrangler:dev': {
          command: 'tsx watch --conditions=typescript ./src/start.ts false true',
        },
      },
    },
    server: {
      port: designSystemPort,
    },
    test: {
      ...baseConfig.test,
      coverage: {
        ...baseConfig.test?.coverage,
        exclude: [
          '**/index.ts',
          'src/components/registry.ts',
          'src/components/base.ts',
          'src/app.tsx',
          'src/main.tsx',
          'src/start.ts',
          '**/*.stories.tsx',
          'src/utils/compile.ts',
          'src/utils/update-stories.ts',
        ],
      },
      environment: 'jsdom',
    },
  });

  return baseConfig;
});
