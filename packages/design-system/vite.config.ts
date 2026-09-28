import fs from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import unoCss from 'unocss/vite';
import { type UserConfig, defineConfig, mergeConfig } from 'vite-plus';

import { getCommonTaskProps, getPackageViteConfig } from '../../vite.config.ts';

export default defineConfig(({ mode }): UserConfig => {
  const designSystemPort = Math.trunc(
    Number(globalThis.process.env['DESIGN_SYSTEM_PORT'] ?? '6007'),
  );
  const dir = import.meta.dirname;
  const commonTaskProps = getCommonTaskProps(path.resolve(dir, '../..'), mode);

  return mergeConfig(
    getPackageViteConfig({
      buildCommand:
        'tsx --conditions=typescript ./src/utils/update-stories.ts && tsx --conditions=typescript ./src/utils/compile.ts && vp pack && vp build && storybook build',
      buildType: 'custom',
      devCommand: 'tsx watch --conditions=typescript ./src/start.ts false false',
      dir,
      excludeDevCommand: false,
      excludeStartCommand: false,
      mode,
      startCommand: 'tsx watch --conditions=typescript ./src/start.ts true false',
    }),
    {
      build: {
        outDir: 'out',
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
      pack: {
        deps: {
          neverBundle: ['typescript'],
        },
        entry: [
          '!src/app.tsx',
          '!src/main.tsx',
          '!src/start.ts',
          '!.storybook/main.ts',
          '!.storybook/manager.ts',
          '!.storybook/mode-channel.ts',
          '!.storybook/mode.tsx',
          '!.storybook/preview.tsx',
        ],
      },
      plugins: [
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
      ],
      preview: {
        port: designSystemPort,
      },
      run: {
        tasks: {
          'test:e2e': {
            cache: {
              ...commonTaskProps.cache,
              output: [{ base: 'package', pattern: 'tmp/e2e/**/*' }],
            },
            command: 'playwright test',
          },
          'wrangler:delete': {
            ...commonTaskProps,
            command:
              'wrangler delete --config wrangler.design-system.toml && wrangler delete --config wrangler.storybook.toml',
          },
          'wrangler:deploy': {
            ...commonTaskProps,
            command:
              'wrangler deploy --config wrangler.design-system.toml && wrangler deploy --config wrangler.storybook.toml',
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
        coverage: {
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
          include: [
            'src/**/*.ts',
            'src/**/*.tsx',
            '.storybook/manager.ts',
            '.storybook/mode-channel.ts',
            '.storybook/mode.tsx',
          ],
        },
        environment: 'jsdom',
      },
    } satisfies UserConfig,
  );
});
