import { logger } from '@lightproject/common/logger';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { functions, ping } from '../../../src/functions';
import { setup } from '../helpers/jobs';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('functions', () => {
  test('registers ping', () => {
    expect(functions).toContain(ping);
  });

  test('ping logs its message with the idempotency key', async () => {
    const info = vi.spyOn(logger, 'info');
    const { store } = setup();
    const now = new Date(0);
    const job = await store.enqueue({
      createdAt: now,
      dedupeKey: null,
      functionName: 'ping',
      id: 'job-1',
      maxAttempts: 1,
      payload: { message: 'hello' },
      runAt: now,
      updatedAt: now,
    });

    await ping.execute(job.payload, {
      attempt: 1,
      idempotencyKey: job.id,
      job,
      logger,
      signal: new globalThis.AbortController().signal,
      skip: () => {},
      withTrace: <R>(fn: () => R) => fn(),
    });

    expect(info).toHaveBeenCalledWith('ping: hello', { attempt: 1, idempotencyKey: 'job-1' });
  });
});
