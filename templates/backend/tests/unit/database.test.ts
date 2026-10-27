import type { repositories } from '@lightproject/datastore';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test';

import { createFakeDatabase } from './helpers/database';

const createDatabase = vi.fn<() => Promise<repositories.Database>>();

vi.mock(import('@lightproject/datastore'), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, db: { ...actual.db, createDatabase } };
});

const importDatabase = async () => {
  vi.resetModules();
  return await import('../../src/database');
};

const hyperdrive = { HYPERDRIVE: { connectionString: 'postgres://hyperdrive' } };

beforeEach(() => {
  createDatabase.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('withServiceContext without a Worker binding (Node)', () => {
  test('opens one shared database lazily and keeps it across requests', async () => {
    const database = createFakeDatabase();
    createDatabase.mockResolvedValue(database);
    const { closeSharedDatabase, withServiceContext } = await importDatabase();

    await withServiceContext(undefined, async () => {});
    expect(createDatabase).not.toHaveBeenCalled();

    const first = await withServiceContext({}, async ({ getDatabase }) => await getDatabase());
    const second = await withServiceContext({}, async ({ getDatabase }) => await getDatabase());
    expect(first).toBe(database);
    expect(second).toBe(database);
    expect(createDatabase).toHaveBeenCalledTimes(1);
    expect(database.close).not.toHaveBeenCalled();

    await closeSharedDatabase();
    expect(database.close).toHaveBeenCalledTimes(1);
  });

  test('retries opening after a failed attempt', async () => {
    const database = createFakeDatabase();
    createDatabase.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(database);
    const { withServiceContext } = await importDatabase();

    await expect(
      withServiceContext({}, async ({ getDatabase }) => await getDatabase()),
    ).rejects.toThrow('boom');
    await expect(
      withServiceContext({}, async ({ getDatabase }) => await getDatabase()),
    ).resolves.toBe(database);
  });

  test('closeSharedDatabase does nothing when no database was opened', async () => {
    const { closeSharedDatabase } = await importDatabase();
    await expect(closeSharedDatabase()).resolves.toBeUndefined();
  });
});

describe('withServiceContext with a Worker binding', () => {
  test('opens one database per request and closes it afterwards', async () => {
    const first = createFakeDatabase();
    const second = createFakeDatabase();
    createDatabase.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const { withServiceContext } = await importDatabase();

    const opened = await withServiceContext(hyperdrive, async ({ getDatabase }) => {
      const database = await getDatabase();
      expect(await getDatabase()).toBe(database);
      return database;
    });
    expect(opened).toBe(first);
    expect(first.close).toHaveBeenCalledTimes(1);

    await withServiceContext(hyperdrive, async ({ getDatabase }) => await getDatabase());
    expect(second.close).toHaveBeenCalledTimes(1);
    expect(createDatabase).toHaveBeenCalledTimes(2);
  });

  test('does not open a database the request never asked for', async () => {
    const { withServiceContext } = await importDatabase();
    await expect(withServiceContext(hyperdrive, vi.fn().mockResolvedValue('done'))).resolves.toBe(
      'done',
    );
    expect(createDatabase).not.toHaveBeenCalled();
  });

  test('reports a failed open once, without trying to close it', async () => {
    createDatabase.mockRejectedValueOnce(new Error('open failed'));
    const { withServiceContext } = await importDatabase();
    const { logger } = await import('@lightproject/common/logger');
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await expect(
      withServiceContext(hyperdrive, async ({ getDatabase }) => await getDatabase()),
    ).rejects.toThrow('open failed');
    expect(warn).not.toHaveBeenCalled();
  });

  test('closes the database even when the request fails, and logs a failed close', async () => {
    const database = createFakeDatabase();
    const closeError = new Error('close failed');
    vi.mocked(database.close).mockRejectedValueOnce(closeError);
    createDatabase.mockResolvedValueOnce(database);
    const { withServiceContext } = await importDatabase();
    const { logger } = await import('@lightproject/common/logger');
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await expect(
      withServiceContext(hyperdrive, async ({ getDatabase }) => {
        await getDatabase();
        throw new Error('request failed');
      }),
    ).rejects.toThrow('request failed');
    expect(database.close).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('Failed to close the request database', {
      error: closeError,
    });
  });
});
