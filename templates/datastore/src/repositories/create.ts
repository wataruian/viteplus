import type { DatabaseDialect } from '../environment/dialect';
import { now } from '../shared';
import type { Database, ScriptLockStore, Tables, WorkerJobQueue } from './types';

interface Timestamped {
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}

const stamped = <Row extends Timestamped>(
  row: Row,
): Omit<Row, keyof Timestamped> & { createdAt: Date; updatedAt: Date } => {
  const at = now();
  return { ...row, createdAt: row.createdAt ?? at, updatedAt: row.updatedAt ?? at };
};

interface RepositoriesOptions {
  close: () => Promise<void>;
  dialect: DatabaseDialect;
  scriptLockStore: ScriptLockStore;
  tables: Tables;
  workerJobQueue: WorkerJobQueue;
}

const createRepositories = ({
  close,
  dialect,
  scriptLockStore,
  tables: { scriptLocks, users, workerJobs },
  workerJobQueue,
}: RepositoriesOptions): Database => ({
  close,
  dialect,
  scriptLocks: {
    ...scriptLockStore,
    findByName: async (name) => await scriptLocks.findBy('name', name),
  },
  users: {
    findByEmail: async (email) => await users.findBy('email', email),
    findById: async (id) => await users.findBy('id', id),
    insert: async (user) => await users.insert(stamped(user)),
    list: async ({ limit }) => await users.list(['createdAt', 'id'], limit),
    remove: async (id) => await users.remove('id', id),
    update: async (id, changes) => await users.update('id', id, changes),
  },
  workerJobs: {
    ...workerJobQueue,
    findById: async (id) => await workerJobs.findBy('id', id),
    insert: async (job) => await workerJobs.insert(stamped(job)),
  },
});

export { createRepositories, stamped };
export type { RepositoriesOptions, Timestamped };
