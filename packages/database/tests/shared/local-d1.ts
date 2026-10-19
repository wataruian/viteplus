import path from 'node:path';

import { migrate } from 'drizzle-orm/d1/migrator';
import { getPlatformProxy } from 'wrangler';

import { type D1Binding, createD1Database } from '../../src/d1/client';

const packageDir = path.resolve(import.meta.dirname, '../..');

const startLocalD1 = async () => {
  const proxy = await getPlatformProxy<{ DB: D1Binding }>({
    configPath: path.join(packageDir, 'wrangler.toml'),
    persist: false,
  });
  const db = createD1Database(proxy.env.DB);
  await migrate(db, { migrationsFolder: path.join(packageDir, 'migrations/d1') });
  return { binding: proxy.env.DB, db, dispose: proxy.dispose };
};

type LocalD1 = Awaited<ReturnType<typeof startLocalD1>>;

export { startLocalD1 };
export type { LocalD1 };
