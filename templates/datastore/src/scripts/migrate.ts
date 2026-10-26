import { resolveDatabaseDialect } from '../environment/dialect';
import { getCloudflareEnv } from '../environment/variables';

const migrate = async () => {
  if (resolveDatabaseDialect() === 'postgres') {
    const { migratePostgres } = await import('./migrate-postgres');
    await migratePostgres();
  } else if (getCloudflareEnv() === '') {
    const { migrateLocalD1 } = await import('./migrate-d1-local');
    await migrateLocalD1();
  } else {
    const { migrateRemoteD1 } = await import('./migrate-d1-remote');
    await migrateRemoteD1();
  }
};

const fail = (error: unknown) => {
  const reason = error instanceof Error ? (error.stack ?? error.message) : JSON.stringify(error);
  globalThis.process.stderr.write(`Migration failed: ${reason}\n`);
  globalThis.process.exit(1);
};

globalThis.queueMicrotask(() => {
  migrate().catch(fail);
});

export { fail, migrate };
