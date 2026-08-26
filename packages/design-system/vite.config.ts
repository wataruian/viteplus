import path from 'node:path';

import { defineConfig } from 'vite-plus';

import { getCommonRunProps, getPackageViteConfig } from '../../vite.config';

export default defineConfig(({ mode }) => {
  const dir = import.meta.dirname;

  const rootDir = path.resolve(dir, '../..');

  const commonRunProps = getCommonRunProps(rootDir, mode);

  const baseConfig = getPackageViteConfig({
    devCommand: 'storybook dev -p 6006',
    dir,
    excludeDevCommand: false,
    excludeStartCommand: false,
    mode,
    startCommand: 'storybook dev -p 6006',
  });

  const basePack = baseConfig.pack && !Array.isArray(baseConfig.pack) ? baseConfig.pack : {};
  const baseRun = baseConfig.run && !Array.isArray(baseConfig.run) ? baseConfig.run : {};
  const baseRunTasks = baseRun.tasks && !Array.isArray(baseRun.tasks) ? baseRun.tasks : {};

  return {
    ...baseConfig,
    pack: {
      ...basePack,
      deps: {
        neverBundle: ['typescript'],
      },
    },
    run: {
      ...baseRun,
      tasks: {
        ...baseRunTasks,
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
        'storybook-build': {
          command: 'storybook build',
          ...commonRunProps,
          output: [
            {
              base: 'package',
              pattern: 'storybook-static/**/*',
            },
          ],
        },
        'update-stories': {
          command: 'tsx --conditions=typescript ./src/utils/update-stories.ts',
          ...commonRunProps,
        },
      },
    },
  };
});
