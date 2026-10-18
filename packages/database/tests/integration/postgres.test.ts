import path from 'node:path';

import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { createPostgresDatabase } from '../../src/postgres';
import { describeDatabase } from '../shared/database-contract';
import { createPostgresTarget } from '../shared/targets';

const url =
  globalThis.process.env['POSTGRES_URL'] ??
  'postgres://lightproject:lightproject@localhost:5432/lightproject';

describeDatabase('postgres', async () => {
  const database = createPostgresDatabase({ url });
  await migrate(database.db, {
    migrationsFolder: path.resolve(import.meta.dirname, '../../migrations/postgres'),
  });
  return createPostgresTarget(database);
});
