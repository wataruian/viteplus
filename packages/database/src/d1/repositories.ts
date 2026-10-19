import { createRepositories } from '../repositories/create';
import { type D1Binding, createD1Database } from './client';
import { createD1Crud } from './crud';
import { users, workerJobs } from './schema';

const createD1Repositories = (binding: D1Binding) => {
  const crud = createD1Crud(createD1Database(binding));
  return createRepositories({
    close: async () => {},
    dialect: 'd1',
    tables: { users: crud(users), workerJobs: crud(workerJobs) },
  });
};

export { createD1Repositories };
