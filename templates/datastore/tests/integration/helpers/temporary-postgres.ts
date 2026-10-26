import path from 'node:path';

import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { createPostgresDatabase } from '../../../src/postgres/client';

const migrationsFolder = path.resolve(import.meta.dirname, '../../../migrations/postgres');

const startTemporaryPostgres = async (serverUrl: string) => {
  const name = `lightproject_test_${globalThis.crypto.randomUUID().replaceAll('-', '')}`;
  const admin = createPostgresDatabase({ max: 1, url: serverUrl });
  await admin.db.execute(sql.raw(`CREATE DATABASE "${name}"`));

  const url = new globalThis.URL(serverUrl);
  url.pathname = `/${name}`;
  const connection = createPostgresDatabase({ max: 1, url: url.toString() });
  await migrate(connection.db, { migrationsFolder });

  return {
    close: async () => {
      try {
        await connection.close();
        await admin.db.execute(sql.raw(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`));
      } finally {
        await admin.close();
      }
    },
    db: connection.db,
    name,
  };
};

export { startTemporaryPostgres };
