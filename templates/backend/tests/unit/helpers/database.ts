import type { repositories, types } from '@lightproject/datastore';
import { vi } from 'vite-plus/test';

import type { ServiceContext } from '../../../src/schema';

const insertUser = async (user: types.NewUser): Promise<types.User> => {
  await Promise.resolve();
  const now = new Date();
  return {
    createdAt: user.createdAt ?? now,
    email: user.email,
    id: user.id ?? globalThis.crypto.randomUUID(),
    name: user.name,
    updatedAt: user.updatedAt ?? now,
  };
};

const enqueueJob = async (job: types.NewWorkerJob): Promise<types.WorkerJob> => {
  await Promise.resolve();
  const now = new Date();
  return {
    attempts: job.attempts ?? 0,
    createdAt: job.createdAt ?? now,
    dedupeKey: job.dedupeKey ?? null,
    functionName: job.functionName,
    id: job.id,
    lastError: job.lastError ?? null,
    leaseExpiresAt: job.leaseExpiresAt ?? null,
    leaseOwner: job.leaseOwner ?? null,
    maxAttempts: job.maxAttempts,
    payload: job.payload,
    runAt: job.runAt,
    status: job.status,
    updatedAt: job.updatedAt ?? now,
  };
};

const createFakeDatabase = (): repositories.Database => ({
  close: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  dialect: 'postgres',
  scriptLocks: {
    acquire: vi.fn(),
    findByName: vi.fn(),
    release: vi.fn(),
    renew: vi.fn(),
  },
  users: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    insert: vi.fn(insertUser),
    list: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
  },
  workerJobs: {
    claim: vi.fn(),
    complete: vi.fn(),
    enqueue: vi.fn(enqueueJob),
    fail: vi.fn(),
    findById: vi.fn(),
    heartbeat: vi.fn(),
    insert: vi.fn(),
    purge: vi.fn(),
    release: vi.fn(),
  },
});

const createFakeServiceContext = (
  database: repositories.Database = createFakeDatabase(),
): ServiceContext => ({
  getDatabase: vi.fn<ServiceContext['getDatabase']>().mockResolvedValue(database),
});

export { createFakeDatabase, createFakeServiceContext };
