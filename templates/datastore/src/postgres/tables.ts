import type { Tables } from '../repositories/types';
import type { AnyPostgresDatabase } from './client';
import { createPostgresCrud } from './crud';
import { users, workerJobs } from './schema';

const createPostgresTables = (db: AnyPostgresDatabase): Tables => {
  const crud = createPostgresCrud(db);
  return { users: crud(users), workerJobs: crud(workerJobs) };
};

export { createPostgresTables };
