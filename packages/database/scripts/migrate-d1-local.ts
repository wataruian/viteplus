import path from 'node:path';

import { migrate } from 'drizzle-orm/d1/migrator';
import { getPlatformProxy } from 'wrangler';

import { type D1Binding, createD1Database } from '../src/d1';

const packageDir = path.resolve(import.meta.dirname, '..');

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

try {
  await migrateLocalD1();
} catch (error) {
  const reason = error instanceof Error ? (error.stack ?? error.message) : JSON.stringify(error);
  globalThis.process.stderr.write(`D1 migration failed: ${reason}\n`);
  globalThis.process.exit(1);
}

export { migrateLocalD1, packageDir };
