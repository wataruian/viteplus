import { execFileSync } from 'node:child_process';
import path from 'node:path';

const packageDir = path.resolve(import.meta.dirname, '..');
const drizzleKit = path.join(packageDir, 'node_modules/.bin/drizzle-kit');
const configs = ['drizzle.postgres.config.ts', 'drizzle.d1.config.ts'];

const migrationNamePattern = /^[a-z\d]+(?:[_-][a-z\d]+)*$/u;

const generateMigrations = (name?: string) => {
  if (name !== undefined && !migrationNamePattern.test(name)) {
    throw new Error(
      `invalid migration name "${name}": use lowercase letters, digits, "_" or "-" (e.g. add_sample)`,
    );
  }
  for (const config of configs) {
    execFileSync(
      drizzleKit,
      ['generate', '--config', config, ...(name === undefined ? [] : ['--name', name])],
      {
        cwd: packageDir,
        stdio: 'inherit',
      },
    );
  }
};

const migrationNameArgument = () => globalThis.process.argv[2];

export {
  configs,
  drizzleKit,
  generateMigrations,
  migrationNameArgument,
  migrationNamePattern,
  packageDir,
};
