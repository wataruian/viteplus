import { getCommonRunProps, getPackageViteConfig } from '../../vite.config';
import { defineConfig } from 'vite-plus';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const dir = import.meta.dirname;

  const rootDir = path.resolve(dir, '../..');

  const commonProps = getCommonRunProps(rootDir, mode);

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
          ...commonProps,
          output: ['tmp/compile'],
        },
      },
    },
  };
});
