import type { DatabaseDialect } from '../environment/dialect';
import type { Database, Tables } from './types';

interface RepositoriesOptions {
  close: () => Promise<void>;
  dialect: DatabaseDialect;
  tables: Tables;
}

const createRepositories = ({
  close,
  dialect,
  tables: { users, workerJobs },
}: RepositoriesOptions): Database => ({
  close,
  dialect,
  users: {
    findByEmail: async (email) => await users.findBy('email', email),
    findById: async (id) => await users.findBy('id', id),
    insert: async (user) => await users.insert(user),
    remove: async (id) => await users.remove('id', id),
    update: async (id, changes) => await users.update('id', id, changes),
  },
  workerJobs: {
    findById: async (id) => await workerJobs.findBy('id', id),
    insert: async (job) => await workerJobs.insert(job),
  },
});

export { createRepositories };
export type { RepositoriesOptions };
