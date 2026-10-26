import path from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

const packageDir = path.resolve(import.meta.dirname, '../..');

const startPglite = async () => {
  const client = new PGlite();
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: path.join(packageDir, 'migrations/postgres') });
  return {
    close: async () => {
      await client.close();
    },
    db,
  };
};

export { startPglite };
