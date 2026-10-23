import path from 'node:path';

import { migrate } from 'drizzle-orm/d1/migrator';
import { getPlatformProxy } from 'wrangler';

import { type D1Binding, createD1Database } from '../d1/client';

const packageDir = globalThis.process.cwd();

const migrateLocalD1 = async () => {
  const proxy = await getPlatformProxy<{ DB: D1Binding }>({
    configPath: path.join(packageDir, 'wrangler.toml'),
    persist: { path: path.resolve(packageDir, '../../.wrangler/state/v3') },
  });
  try {
    await migrate(createD1Database(proxy.env.DB), {
      migrationsFolder: path.join(packageDir, 'migrations/d1'),
    });
    globalThis.process.stdout.write('Local D1 is up to date\n');
  } finally {
    await proxy.dispose();
  }
};

export { migrateLocalD1, packageDir };
