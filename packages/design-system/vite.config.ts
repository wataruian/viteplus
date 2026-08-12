import path from 'node:path';

import { defineConfig } from 'vite-plus';

import { getCommonRunProps, getPackageViteConfig } from '../../vite.config';

export default defineConfig(({ mode }) => {
  const dir = import.meta.dirname;

  const rootDir = path.resolve(dir, '../..');

  const commonRunProps = getCommonRunProps(rootDir, mode);

  const baseConfig = getPackageViteConfig({
    dir,
    mode,
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
      },
    },
  };
});
