import type { Tables } from '../repositories/types';
import type { AnyPostgresDatabase } from './client';
import { createPostgresCrud } from './crud';
import { scriptLocks, users, workerJobs } from './schema';

const createPostgresTables = (db: AnyPostgresDatabase): Tables => {
  const crud = createPostgresCrud(db);
  return { scriptLocks: crud(scriptLocks), users: crud(users), workerJobs: crud(workerJobs) };
};

export { createPostgresTables };
