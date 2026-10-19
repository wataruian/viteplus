import type { PgAsyncDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import { createRepositories } from '../repositories/create';
import { createPostgresDatabase } from './client';
import { createPostgresCrud } from './crud';
import { users, workerJobs } from './schema';

const createPostgresRepositories = (
  db: PgAsyncDatabase<PgQueryResultHKT>,
  close: () => Promise<void>,
) => {
  const crud = createPostgresCrud(db);
  return createRepositories({
    close,
    dialect: 'postgres',
    tables: { users: crud(users), workerJobs: crud(workerJobs) },
  });
};

const connectPostgresRepositories = (url: string) => {
  const { close, db } = createPostgresDatabase({ url });
  return createPostgresRepositories(db, close);
};

export { connectPostgresRepositories, createPostgresRepositories };
