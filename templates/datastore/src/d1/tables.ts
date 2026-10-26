import type { Tables } from '../repositories/types';
import type { D1Database } from './client';
import { createD1Crud } from './crud';
import { users, workerJobs } from './schema';

const createD1Tables = (db: D1Database): Tables => {
  const crud = createD1Crud(db);
  return { users: crud(users), workerJobs: crud(workerJobs) };
};

export { createD1Tables };
