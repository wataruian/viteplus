import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { createPostgresDatabase } from '../../src/postgres';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createPostgresDatabase', () => {
  test('creates a lazy pool that can be closed without ever connecting', async () => {
    const { close, db } = createPostgresDatabase({ max: 1, url: 'postgres://u@127.0.0.1:1/none' });

    expect(db.$client.options.max).toBe(1);
    await expect(close()).resolves.toBeUndefined();
  });

  test('defaults to a pool of 10', async () => {
    const { close, db } = createPostgresDatabase({ url: 'postgres://u@127.0.0.1:1/none' });

    expect(db.$client.options.max).toBe(10);
    await close();
  });

  test('passes server notices to onNotice, and ignores them by default', async () => {
    const onNotice = vi.fn<(message: string) => void>();
    const custom = createPostgresDatabase({ onNotice, url: 'postgres://u@127.0.0.1:1/none' });
    const quiet = createPostgresDatabase({ url: 'postgres://u@127.0.0.1:1/none' });

    custom.db.$client.options.onnotice({ message: 'relation already exists, skipping' });
    quiet.db.$client.options.onnotice({ message: 'ignored' });

    expect(onNotice).toHaveBeenCalledExactlyOnceWith('relation already exists, skipping');
    await Promise.all([custom.close(), quiet.close()]);
  });
});
