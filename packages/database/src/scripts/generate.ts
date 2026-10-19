import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import * as postgres from '../postgres/schema';
import { generateMigrations, migrationNameArgument, packageDir } from './migrations';
import { renderD1Schema } from './render-d1-schema';

const target = path.resolve(packageDir, 'src/d1/schema.ts');
const vp = path.join(packageDir, 'node_modules/.bin/vp');

const syncD1Schema = () => {
  const before = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  fs.writeFileSync(target, renderD1Schema(postgres));
  try {
    execFileSync(vp, ['check', '--fix', target], { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    const output =
      error instanceof Error && 'stdout' in error && 'stderr' in error
        ? `${String(error.stdout)}${String(error.stderr)}`
        : '';
    throw new Error(`generated src/d1/schema.ts does not pass \`vp check\`:\n${output}`, {
      cause: error,
    });
  }
  const after = fs.readFileSync(target, 'utf8');
  globalThis.process.stdout.write(
    before === after
      ? 'D1 schema already in sync with the Postgres schema\n'
      : 'D1 schema updated from the Postgres schema (src/d1/schema.ts)\n',
  );
};

try {
  syncD1Schema();
  generateMigrations(migrationNameArgument());
} catch (error) {
  const reason = error instanceof Error ? error.message : JSON.stringify(error);
  globalThis.process.stderr.write(`db:generate failed: ${reason}\n`);
  globalThis.process.exit(1);
}

export { syncD1Schema, target, vp };
