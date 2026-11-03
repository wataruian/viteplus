import { logger } from '@lightproject/common/logger';
import type { repositories, types } from '@lightproject/datastore';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { createJobClient } from '../../../src/core/client';
import { UnrecoverableJobError } from '../../../src/core/function';
import { functions, listUsers } from '../../../src/functions';
import { createMemoryStore } from '../../../src/stores/memory';
import { createFakeDatabase } from '../helpers/database';

afterEach(() => {
  vi.restoreAllMocks();
});

const user: types.User = {
  createdAt: new Date(0),
  email: 'ada@example.com',
  id: 'user-1',
  name: 'Ada',
  updatedAt: new Date(0),
};

const run = async (
  payload: { limit?: number },
  database: repositories.Database,
  signal = new globalThis.AbortController().signal,
) => {
  const client = createJobClient(createMemoryStore());
  const job = await client.enqueue(listUsers, { limit: 100 });
  const getDatabase = vi.fn<() => Promise<repositories.Database>>().mockResolvedValue(database);
  await listUsers.execute(payload, {
    attempt: 1,
    getDatabase,
    idempotencyKey: job.id,
    job,
    logger,
    signal,
    skip: () => {},
    withTrace: <R>(fn: () => R) => fn(),
  });
  return { getDatabase, job };
};

describe('listUsers', () => {
  test('is registered', () => {
    expect(functions).toContain(listUsers);
  });

  test('lists users from the database and logs them without timestamps', async () => {
    const info = vi.spyOn(logger, 'info');
    const database = createFakeDatabase([user]);

    const { job } = await run({ limit: 5 }, database);

    expect(database.users.list).toHaveBeenCalledWith({ limit: 5 });
    expect(info).toHaveBeenCalledWith('list-users', {
      count: 1,
      idempotencyKey: job.id,
      users: [{ email: 'ada@example.com', id: 'user-1', name: 'Ada' }],
    });
  });

  test('defaults the limit to 100', async () => {
    const database = createFakeDatabase();

    await run({}, database);

    expect(database.users.list).toHaveBeenCalledWith({ limit: 100 });
  });

  test('rejects an out-of-range limit without opening the database', async () => {
    const database = createFakeDatabase();

    const rejection = run({ limit: 0 }, database);

    await expect(rejection).rejects.toBeInstanceOf(UnrecoverableJobError);
    expect(database.users.list).not.toHaveBeenCalled();
  });

  test('stops before querying once aborted', async () => {
    const controller = new globalThis.AbortController();
    controller.abort();
    const database = createFakeDatabase();

    await expect(run({}, database, controller.signal)).rejects.toThrow();
    expect(database.users.list).not.toHaveBeenCalled();
  });
});
