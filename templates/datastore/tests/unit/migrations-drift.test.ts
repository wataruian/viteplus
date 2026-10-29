import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vite-plus/test';

const packageDir = path.resolve(import.meta.dirname, '../..');
const drizzleKit = path.join(packageDir, 'node_modules/.bin/drizzle-kit');

const generateAgainstCopy = (dialect: string, schema: string, migrations: string) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'drizzle-drift-'));
  try {
    fs.cpSync(path.join(packageDir, migrations), scratch, { recursive: true });
    return execFileSync(
      drizzleKit,
      ['generate', '--dialect', dialect, '--schema', schema, '--out', scratch],
      { cwd: packageDir, encoding: 'utf8' },
    );
  } finally {
    fs.rmSync(scratch, { force: true, recursive: true });
  }
};

describe('committed migrations match the schema', () => {
  test.each([
    ['postgresql', './src/postgres/schema.ts', 'migrations/postgres'],
    ['sqlite', './src/d1/schema.ts', 'migrations/d1'],
  ])('%s: no pending schema changes (run `vpr db:generate` if this fails)', (...args) => {
    expect(generateAgainstCopy(...args)).toContain('No schema changes');
  });
});
