import path from 'node:path';

import { defineConfig } from 'vite-plus';

import { getCommonRunProps, getPackageViteConfig } from '../../vite.config';

export default defineConfig(({ mode }) => {
  const dir = import.meta.dirname;

  const rootDir = path.resolve(dir, '../..');

  const commonRunProps = getCommonRunProps(rootDir, mode);

  const baseConfig = getPackageViteConfig({
    dir,
    excludeDevCommand: false,
    excludeStartCommand: false,
    mode,
    startCommand: 'node dist/index.mjs',
  });

  const basePack = baseConfig.pack && !Array.isArray(baseConfig.pack) ? baseConfig.pack : {};
  const baseRun = baseConfig.run && !Array.isArray(baseConfig.run) ? baseConfig.run : {};
  const baseRunTasks = baseRun.tasks && !Array.isArray(baseRun.tasks) ? baseRun.tasks : {};

  return {
    ...baseConfig,
    pack: {
      ...basePack,
      deps: {
        neverBundle: ['express-serve-static-core', 'extend'],
      },
    },
    run: {
      ...baseRun,
      tasks: {
        ...baseRunTasks,
        autogen: {
          command: 'tsx --conditions=typescript ./src/utils/autogen.ts',
          ...commonRunProps,
          output: [
            {
              base: 'package',
              pattern: 'tmp/autogen/**/*',
            },
          ],
        },
      },
    },
  };
});
