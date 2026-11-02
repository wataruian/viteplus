import type { D1Binding } from './d1/client';
import { resolveDatabaseDialect } from './environment/dialect';
import { getDatabaseDialect, getPostgresUrl } from './environment/variables';
import type { Database } from './repositories/types';

interface DatabaseEnv {
  DATABASE_DIALECT?: string;
  DATASTORE_POSTGRES_URL?: string;
  DB?: D1Binding;
  HYPERDRIVE?: { connectionString: string };
}

const resolvePostgresUrl = (env: DatabaseEnv) =>
  env.HYPERDRIVE?.connectionString ?? env.DATASTORE_POSTGRES_URL ?? getPostgresUrl();

const createDatabase = async (env: DatabaseEnv = {}): Promise<Database> => {
  const dialect = resolveDatabaseDialect(env.DATABASE_DIALECT ?? getDatabaseDialect());

  if (dialect === 'postgres') {
    const { connectPostgresRepositories } = await import('./postgres/repositories');
    return connectPostgresRepositories(resolvePostgresUrl(env));
  }
  if (env.DB === undefined) {
    throw new Error('DATABASE_DIALECT is d1 but no D1 binding was passed as env.DB');
  }
  const { createD1Repositories } = await import('./d1/repositories');
  return createD1Repositories(env.DB);
};

export { createDatabase, resolvePostgresUrl };
export type { DatabaseEnv };
