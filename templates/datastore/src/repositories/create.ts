import type { DatabaseDialect } from '../environment/dialect';
import { now } from '../shared';
import type { User } from '../types';
import type { Page } from './table';
import type { Database, ListUsers, ScriptLockStore, Tables, WorkerJobQueue } from './types';

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

const userPage = ({ limit, offset, order = 'asc' }: ListUsers): Page<User> => ({
  limit,
  offset,
  orderBy: [
    { column: 'createdAt', direction: order },
    { column: 'id', direction: order },
  ],
});

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
    count: async ({ where } = {}) => await users.count(where),
    findByEmail: async (email) => await users.findBy('email', email),
    findById: async (id) => await users.findBy('id', id),
    findMany: async ({ where, ...page }) => await users.findMany(where, userPage(page)),
    insert: async (user) => await users.insert(stamped(user)),
    insertMany: async (rows) => await users.insertMany(rows.map((user) => stamped(user))),
    list: async (page) => await users.list(userPage(page)),
    remove: async (id) => (await users.removeBy('id', id)) !== undefined,
    removeMany: async ({ where }) => await users.removeMany(where),
    search: async ({ where, ...page }) => await users.search(where, userPage(page)),
    update: async (id, changes) => await users.updateBy('id', id, changes),
    updateMany: async ({ changes, where }) => await users.updateMany(where, changes),
    upsert: async (user) =>
      await users.upsert(stamped(user), {
        set: { name: user.name, updatedAt: now() },
        target: 'email',
      }),
  },
  workerJobs: {
    ...workerJobQueue,
    findById: async (id) => await workerJobs.findBy('id', id),
    insert: async (job) => await workerJobs.insert(stamped(job)),
  },
});

export { createRepositories, stamped, userPage };
export type { RepositoriesOptions, Timestamped };
