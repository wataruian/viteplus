import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vite-plus/test';

import {
  UnsupportedQueryError,
  d1RenderedModules,
  renderD1Query,
} from '../../src/scripts/render-d1-queries';

const packageDir = path.resolve(import.meta.dirname, '../..');
const vp = path.join(packageDir, 'node_modules/.bin/vp');

const read = (file: string) => fs.readFileSync(path.join(packageDir, file), 'utf8');

describe('renderD1Query', () => {
  test('renames the dialect identifiers and drops row locks', () => {
    const source = [
      "import type { PgTable } from 'drizzle-orm/pg-core';",
      "import type { AnyPostgresDatabase } from './client';",
      'const createPostgresQueue = (db: AnyPostgresDatabase, table: PgTable) =>',
      "  db.select().from(table).limit(1).for('update', { skipLocked: true });",
      '',
    ].join('\n');

    expect(renderD1Query('crud.ts', source)).toBe(
      [
        "import type { SQLiteTable } from 'drizzle-orm/sqlite-core';",
        "import type { D1Database } from './client';",
        'const createD1Queue = (db: D1Database, table: SQLiteTable) =>',
        '  db.select().from(table).limit(1);',
        '',
      ].join('\n'),
    );
  });

  test.each([
    ["import { pgTable } from 'drizzle-orm/pg-core';", 'pgTable'],
    ["import { drizzle } from 'drizzle-orm/postgres-js';", 'postgres-js'],
    ['const db: PgAsyncDatabase = open();', 'PgAsyncDatabase'],
    ['const db: PostgresDatabase = open();', 'PostgresDatabase'],
    ["query.for('share');", '.for('],
  ])('rejects a Postgres-only construct: %s', (source, construct) => {
    expect(() => renderD1Query('worker-jobs.ts', source)).toThrow(
      new UnsupportedQueryError('worker-jobs.ts', construct),
    );
  });
});

describe('committed D1 query modules match their Postgres source', () => {
  test.each(d1RenderedModules)('src/d1/%s (run `vp run db:generate` if this fails)', (file) => {
    const target = `src/d1/${file}`;
    const formatted = execFileSync(vp, ['fmt', `--stdin-filepath=${target}`], {
      cwd: packageDir,
      encoding: 'utf8',
      input: renderD1Query(file, read(`src/postgres/${file}`)),
    });

    expect(formatted).toBe(read(target));
  });
});
