import path from 'node:path';

import type { db } from '@lightproject/database';
import { drizzle } from 'drizzle-orm/d1';
import { migrate } from 'drizzle-orm/d1/migrator';
import { getPlatformProxy } from 'wrangler';

type D1Binding = NonNullable<db.DatabaseEnv['DB']>;

interface LocalD1 {
  binding: D1Binding;
  dispose: () => Promise<void>;
}

const databaseDir = path.resolve(import.meta.dirname, '../../../../../packages/database');
const migrationsDir = path.join(databaseDir, 'migrations/d1');

const startLocalD1 = async (): Promise<LocalD1> => {
  const proxy = await getPlatformProxy<{ DB: D1Binding }>({
    configPath: path.join(databaseDir, 'wrangler.toml'),
    persist: false,
  });
  await migrate(drizzle(proxy.env.DB), { migrationsFolder: migrationsDir });
  return { binding: proxy.env.DB, dispose: proxy.dispose };
};

export { startLocalD1 };
export type { LocalD1 };
