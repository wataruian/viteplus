import path from 'node:path';

import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { resolveDatabaseDialect } from '../../src/environment/dialect';
import { getPostgresUrl } from '../../src/environment/variables';
import { createPostgresDatabase } from '../../src/postgres/client';
import { describeDatabase } from '../shared/database-contract';
import { startLocalD1 } from '../shared/local-d1';
import { createD1Target, createPostgresTarget } from '../shared/targets';

const dialect = resolveDatabaseDialect();

describeDatabase(dialect, async () => {
  if (dialect === 'd1') {
    return createD1Target(await startLocalD1());
  }
  const connection = createPostgresDatabase({ url: getPostgresUrl() });
  await migrate(connection.db, {
    migrationsFolder: path.resolve(import.meta.dirname, '../../migrations/postgres'),
  });
  return createPostgresTarget(connection);
});
