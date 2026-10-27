import { createRepositories } from '../repositories/create';
import { type AnyPostgresDatabase, createPostgresDatabase } from './client';
import { createPostgresScriptLockStore } from './script-locks';
import { createPostgresTables } from './tables';
import { createPostgresWorkerJobQueue } from './worker-jobs';

const createPostgresRepositories = (db: AnyPostgresDatabase, close: () => Promise<void>) =>
  createRepositories({
    close,
    dialect: 'postgres',
    scriptLockStore: createPostgresScriptLockStore(db),
    tables: createPostgresTables(db),
    workerJobQueue: createPostgresWorkerJobQueue(db),
  });

const connectPostgresRepositories = (url: string) => {
  const { close, db } = createPostgresDatabase({ url });
  return createPostgresRepositories(db, close);
};

export { connectPostgresRepositories, createPostgresRepositories };
