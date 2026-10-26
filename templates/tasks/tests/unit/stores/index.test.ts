import { describe, expect, test } from 'vite-plus/test';

import { createJobStore } from '../../../src/stores';
import { startLocalD1 } from '../helpers/local-d1';

const storeMethods = [
  'claim',
  'close',
  'complete',
  'enqueue',
  'fail',
  'findById',
  'heartbeat',
  'purge',
  'release',
];

describe('createJobStore', () => {
  test('memory', async () => {
    const store = await createJobStore('memory');

    expect(Object.keys(store).toSorted()).toStrictEqual(storeMethods);
    await store.close();
  });

  test('database connects through db.createDatabase(env)', async () => {
    const local = await startLocalD1();
    try {
      const store = await createJobStore('database', { DATABASE_DIALECT: 'd1', DB: local.binding });

      expect(Object.keys(store).toSorted()).toStrictEqual(storeMethods);
      await expect(store.findById('missing')).resolves.toBeUndefined();
      await store.close();
    } finally {
      await local.dispose();
    }
  });

  test('database without a D1 binding names what is missing', async () => {
    await expect(createJobStore('database', { DATABASE_DIALECT: 'd1' })).rejects.toThrow(
      'no D1 binding was passed as env.DB',
    );
  });
});
