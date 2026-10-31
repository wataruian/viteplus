import { logger } from '@lightproject/common/logger';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { listUsers, scripts } from '../../../src/scripts';
import { useLocalDatabase } from '../helpers/database';
import { context, runDirectly } from '../helpers/scripts';

const { openDatabase } = useLocalDatabase();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('list-users', () => {
  test('is registered every 5 minutes', () => {
    expect(scripts).toContain(listUsers);
    expect(listUsers.schedule).toBe('*/5 * * * *');
  });

  test('logs the count and each user id, name and email, oldest first', async () => {
    const database = await openDatabase();
    const ada = await database.users.insert({
      createdAt: new Date(1),
      email: 'ada@example.com',
      name: 'Ada',
    });
    const grace = await database.users.insert({
      createdAt: new Date(2),
      email: 'grace@example.com',
      name: 'Grace',
    });
    const info = vi.spyOn(logger, 'info');

    await runDirectly(listUsers, {}, context(database, { trigger: 'schedule' }));
    await runDirectly(listUsers, { limit: 1 }, context(database));

    expect(info).toHaveBeenNthCalledWith(1, 'list-users', {
      count: 2,
      users: [
        { email: 'ada@example.com', id: ada.id, name: 'Ada' },
        { email: 'grace@example.com', id: grace.id, name: 'Grace' },
      ],
    });
    expect(info).toHaveBeenNthCalledWith(2, 'list-users', {
      count: 1,
      users: [{ email: 'ada@example.com', id: ada.id, name: 'Ada' }],
    });
  });

  test('rejects a limit outside 1-1000', () => {
    expect(listUsers.prepare({ limit: 0 })).toHaveProperty('error');
    expect(listUsers.prepare({ limit: 1001 })).toHaveProperty('error');
  });
});
