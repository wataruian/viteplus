import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import type * as sharedModule from '../../src/shared';
import { startLocalD1 } from '../shared/local-d1';

afterEach(() => {
  vi.doUnmock('../../src/shared');
  vi.resetModules();
});

describe('stamped', () => {
  test('fills both timestamps from one clock reading, keeping explicit ones', async () => {
    const { stamped } = await import('../../src/repositories/create');
    const explicit = new Date('2026-01-01T00:00:00.000Z');

    const filled = stamped({ createdAt: undefined });
    expect(filled.createdAt).toBeInstanceOf(Date);
    expect(filled.updatedAt).toBe(filled.createdAt);
    const created = stamped({ createdAt: explicit });
    expect(created.createdAt).toBe(explicit);
    expect(created.updatedAt).not.toBe(explicit);
    expect(stamped({ updatedAt: explicit }).updatedAt).toBe(explicit);
  });

  test('a new row gets identical timestamps even when the clock ticks between columns', async () => {
    let tick = Date.parse('2026-01-01T00:00:00.000Z');
    vi.doMock('../../src/shared', async (importOriginal) => ({
      ...(await importOriginal<typeof sharedModule>()),
      now: () => {
        tick += 1;
        return new Date(tick);
      },
    }));
    const { createD1Repositories } = await import('../../src/d1/repositories');
    const local = await startLocalD1();
    try {
      const { users } = createD1Repositories(local.binding);

      const user = await users.insert({ email: 'tick@example.com', name: 'Ada' });

      expect(user.updatedAt.getTime()).toBe(user.createdAt.getTime());
    } finally {
      await local.dispose();
    }
  });
});
