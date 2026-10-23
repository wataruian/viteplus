import { createRepositories } from '../repositories/create';
import { type D1Binding, createD1Database } from './client';
import { createD1Tables } from './tables';
import { createD1WorkerJobQueue } from './worker-jobs';

const createD1Repositories = (binding: D1Binding) => {
  const db = createD1Database(binding);
  return createRepositories({
    close: async () => {},
    dialect: 'd1',
    tables: createD1Tables(db),
    workerJobQueue: createD1WorkerJobQueue(db),
  });
};

export { createD1Repositories };
