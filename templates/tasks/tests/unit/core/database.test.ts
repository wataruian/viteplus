import { logger } from '@lightproject/common/logger';
import type { repositories } from '@lightproject/datastore';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { createLazyDatabase, noDatabase } from '../../../src/core/database';
import { createFakeDatabase } from '../helpers/database';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createLazyDatabase', () => {
  test('opens nothing until a job asks for the database', async () => {
    const open = vi.fn<() => Promise<repositories.Database>>();
    const lazy = createLazyDatabase(open);

    await lazy.close();

    expect(open).not.toHaveBeenCalled();
  });

  test('opens the database once and shares it', async () => {
    const database = createFakeDatabase();
    const open = vi.fn<() => Promise<repositories.Database>>().mockResolvedValue(database);
    const lazy = createLazyDatabase(open);

    const [first, second] = await Promise.all([lazy.getDatabase(), lazy.getDatabase()]);

    expect(first).toBe(database);
    expect(second).toBe(database);
    expect(open).toHaveBeenCalledTimes(1);
  });

  test('retries the open after a failure', async () => {
    const database = createFakeDatabase();
    const open = vi
      .fn<() => Promise<repositories.Database>>()
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValue(database);
    const lazy = createLazyDatabase(open);

    await expect(lazy.getDatabase()).rejects.toThrow('connection refused');
    await expect(lazy.getDatabase()).resolves.toBe(database);
    expect(open).toHaveBeenCalledTimes(2);
  });

  test('closes the opened database and opens a fresh one afterwards', async () => {
    const first = createFakeDatabase();
    const second = createFakeDatabase();
    const open = vi
      .fn<() => Promise<repositories.Database>>()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const lazy = createLazyDatabase(open);

    await lazy.getDatabase();
    await lazy.close();

    expect(first.close).toHaveBeenCalledTimes(1);
    await expect(lazy.getDatabase()).resolves.toBe(second);
  });

  test('closes cleanly when an open still in flight fails', async () => {
    const { promise, reject } = Promise.withResolvers<repositories.Database>();
    const lazy = createLazyDatabase(async () => await promise);

    const opening = lazy.getDatabase();
    const closing = lazy.close();
    reject(new Error('connection refused'));

    await expect(opening).rejects.toThrow('connection refused');
    await expect(closing).resolves.toBeUndefined();
  });

  test('logs instead of throwing when closing fails', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const database = createFakeDatabase();
    vi.mocked(database.close).mockRejectedValue(new Error('already closed'));
    const lazy = createLazyDatabase(async () => await Promise.resolve(database));

    await lazy.getDatabase();
    await expect(lazy.close()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe('Failed to close the job database');
  });
});

describe('noDatabase', () => {
  test('rejects with a clear message', async () => {
    await expect(noDatabase()).rejects.toThrow('No database is available to this job executor');
  });
});
