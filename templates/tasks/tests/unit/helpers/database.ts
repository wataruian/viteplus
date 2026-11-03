import type { repositories, types } from '@lightproject/datastore';
import { vi } from 'vite-plus/test';

const createFakeDatabase = (users: types.User[] = []): repositories.Database => ({
  close: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  dialect: 'postgres',
  scriptLocks: {
    acquire: vi.fn(),
    findByName: vi.fn(),
    release: vi.fn(),
    renew: vi.fn(),
  },
  users: {
    count: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    insert: vi.fn(),
    insertMany: vi.fn(),
    list: vi.fn<repositories.Database['users']['list']>().mockResolvedValue(users),
    remove: vi.fn(),
    removeMany: vi.fn(),
    search: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
  workerJobs: {
    claim: vi.fn(),
    complete: vi.fn(),
    enqueue: vi.fn(),
    fail: vi.fn(),
    findById: vi.fn(),
    heartbeat: vi.fn(),
    insert: vi.fn(),
    purge: vi.fn(),
    release: vi.fn(),
  },
});

export { createFakeDatabase };
