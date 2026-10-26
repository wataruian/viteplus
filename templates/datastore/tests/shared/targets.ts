import { sql } from 'drizzle-orm';
import type { PgAsyncDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import { createD1Repositories } from '../../src/d1/repositories';
import { createPostgresRepositories } from '../../src/postgres/repositories';
import type { ContractTarget } from './database-contract';
import type { LocalD1 } from './local-d1';

interface PostgresConnection {
  close: () => Promise<void>;
  db: PgAsyncDatabase<PgQueryResultHKT>;
}

const createPostgresTarget = ({ close, db }: PostgresConnection): ContractTarget => ({
  database: createPostgresRepositories(db, close),
  insertJobWithRawStatus: async (job, status) => {
    await db.execute(sql`
      INSERT INTO worker_jobs (id, function_name, payload, status, max_attempts, run_at, created_at, updated_at)
      VALUES (${job.id}, ${job.functionName}, '{}'::jsonb, ${status}, 1, now(), now(), now())`);
  },
});

const createD1Target = ({ binding, db, dispose }: LocalD1): ContractTarget => ({
  database: { ...createD1Repositories(binding), close: dispose },
  insertJobWithRawStatus: async (job, status) => {
    await db.run(sql`
      INSERT INTO worker_jobs (id, function_name, payload, status, max_attempts, run_at, created_at, updated_at)
      VALUES (${job.id}, ${job.functionName}, '{}', ${status}, 1, 0, 0, 0)`);
  },
});

export { createD1Target, createPostgresTarget };
