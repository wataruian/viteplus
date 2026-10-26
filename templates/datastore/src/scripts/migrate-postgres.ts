import path from 'node:path';

import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { getPostgresUrl } from '../environment/variables';
import { createPostgresDatabase } from '../postgres/client';

const migrationsFolder = path.resolve('migrations/postgres');

const migratePostgres = async () => {
  const { close, db } = createPostgresDatabase({ max: 1, url: getPostgresUrl() });
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await close();
  }
  globalThis.process.stdout.write('Postgres is up to date\n');
};

export { migratePostgres, migrationsFolder };
