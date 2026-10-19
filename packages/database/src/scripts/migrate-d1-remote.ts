import path from 'node:path';

import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { migrate } from 'drizzle-orm/sqlite-proxy/migrator';

import { createRemoteD1Query, resolveRemoteD1 } from './remote-d1';

const migrationsFolder = path.resolve('migrations/d1');

const joinStatements = (statements: readonly string[]) =>
  statements
    .map((statement) => statement.trim().replace(/;$/u, ''))
    .filter((statement) => statement !== '')
    .join(';\n');

const migrateRemoteD1 = async () => {
  const remote = resolveRemoteD1();
  const query = createRemoteD1Query(remote);
  const db = drizzle(async (sql, params, method) => {
    const rows = await query(sql, params);
    return { rows: method === 'get' ? rows[0] : rows };
  });

  globalThis.process.stdout.write(
    `Migrating remote D1 "${remote.databaseName}" (${remote.cloudflareEnv})…\n`,
  );
  await migrate(
    db,
    async (statements) => {
      const sql = joinStatements(statements);
      if (sql !== '') {
        await query(sql);
      }
    },
    { migrationsFolder },
  );
  const applied = await query('SELECT name FROM __drizzle_migrations ORDER BY id');
  globalThis.process.stdout.write(
    `Remote D1 "${remote.databaseName}" is up to date (${applied.length} migration(s) applied)\n`,
  );
};

export { joinStatements, migrateRemoteD1, migrationsFolder };
