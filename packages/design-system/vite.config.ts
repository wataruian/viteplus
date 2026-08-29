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
    buildCommand: 'vp pack && vp build && storybook build',
    buildType: 'custom',
    devCommand: 'tsx watch --conditions=typescript ./src/start.ts false',
    dir,
    excludeDevCommand: false,
    excludeStartCommand: false,
    mode,
    startCommand: 'tsx watch --conditions=typescript ./src/start.ts true',
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
        compile: {
          command: 'tsx --conditions=typescript ./src/utils/compile.ts',
          ...commonRunProps,
          output: [
            {
              base: 'package',
              pattern: 'tmp/compile/**/*',
            },
          ],
        },
        'update-stories': {
          command: 'tsx --conditions=typescript ./src/utils/update-stories.ts',
          ...commonRunProps,
        },
      },
    },
    server: {
      port: designSystemPort,
    },
  });

  return baseConfig;
});
