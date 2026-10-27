import { logger } from '@lightproject/common/logger';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { isPurgeDue, purgeFinished, startPurger } from '../../../src/core/retention';
import { claimFor, setup } from '../helpers/jobs';

afterEach(() => {
  vi.restoreAllMocks();
});

const retention = { deadMs: 3000, succeededMs: 1000 };

const finishJobs = async (
  context: ReturnType<typeof setup>,
  count: number,
  status: 'succeeded' | 'dead',
) => {
  const { client, definition, store, time } = context;
  await Promise.all(
    Array.from({ length: count }, async (_, value) => {
      await client.enqueue(definition, { value });
    }),
  );
  const claimed = await Promise.all(
    Array.from(
      { length: count },
      async () => await store.claim(claimFor(time.clock, 'test', 'w', 1000)),
    ),
  );
  await Promise.all(
    claimed.map(async (job) => {
      const held = {
        attempt: job?.attempts ?? 0,
        id: job?.id ?? '',
        leaseOwner: 'w',
        now: new Date(time.clock()),
      };
      await (status === 'succeeded'
        ? store.complete(held)
        : store.fail({ ...held, lastError: 'x', retryAfterMs: undefined }));
    }),
  );
};

describe('purgeFinished', () => {
  test('deletes each status after its own retention', async () => {
    const context = setup();
    await finishJobs(context, 2, 'succeeded');
    await finishJobs(context, 1, 'dead');
    const options = { clock: context.time.clock, retention, store: context.store };

    await expect(purgeFinished(options)).resolves.toStrictEqual({ dead: 0, succeeded: 0 });
    context.time.advance(1001);
    await expect(purgeFinished(options)).resolves.toStrictEqual({ dead: 0, succeeded: 2 });
    context.time.advance(2000);
    await expect(purgeFinished(options)).resolves.toStrictEqual({ dead: 1, succeeded: 0 });
  });

  test('works through batches up to maxBatches per sweep', async () => {
    const context = setup();
    await finishJobs(context, 5, 'succeeded');
    context.time.advance(1001);
    const purge = vi.spyOn(context.store, 'purge');
    const options = {
      batchSize: 2,
      clock: context.time.clock,
      maxBatches: 2,
      retention,
      store: context.store,
    };

    await expect(purgeFinished(options)).resolves.toMatchObject({ succeeded: 4 });
    await expect(purgeFinished(options)).resolves.toMatchObject({ succeeded: 1 });
    expect(purge.mock.calls.filter(([{ status }]) => status === 'succeeded')).toHaveLength(3);
  });

  test('uses the default clock, batch size and batch limit', async () => {
    const context = setup();
    await finishJobs(context, 1, 'succeeded');
    const purge = vi.spyOn(context.store, 'purge');

    const before = Date.now();

    await purgeFinished({ retention: { deadMs: 0, succeededMs: -1e12 }, store: context.store });

    const succeeded = purge.mock.calls
      .map(([call]) => call)
      .find((call) => call.status === 'succeeded');
    expect(succeeded?.limit).toBe(500);
    expect(succeeded?.updatedBefore.getTime()).toBeGreaterThanOrEqual(before + 1e12);
  });
});

describe('isPurgeDue', () => {
  const hour = 3_600_000;
  const minute = 60_000;

  test('is due only on the first tick of each interval', () => {
    expect(isPurgeDue(5 * hour, hour, minute)).toBe(true);
    expect(isPurgeDue(5 * hour + minute - 1, hour, minute)).toBe(true);
    expect(isPurgeDue(5 * hour + minute, hour, minute)).toBe(false);
    expect(isPurgeDue(5 * hour + 59 * minute, hour, minute)).toBe(false);
  });

  test('is due exactly once per interval, even when it is not a multiple of the tick', () => {
    const interval = 90_000;
    const due = Array.from({ length: 30 }, (_, tick) =>
      isPurgeDue(tick * minute, interval, minute),
    ).filter(Boolean).length;

    expect(due).toBe(20);
  });

  test('is always due when the interval is no longer than a tick', () => {
    expect(isPurgeDue(5 * hour + 30 * minute, minute, minute)).toBe(true);
    expect(isPurgeDue(5 * hour + 30 * minute, 1000, minute)).toBe(true);
  });
});

describe('startPurger', () => {
  test('sweeps on start and on every interval until stopped', async () => {
    const context = setup();
    const purge = vi.spyOn(context.store, 'purge');

    const purger = startPurger({ intervalMs: 5, retention, store: context.store });
    await vi.waitFor(() => {
      expect(purge.mock.calls.length).toBeGreaterThanOrEqual(4);
    });
    await purger.stop();
    const calls = purge.mock.calls.length;
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 20);
    });

    expect(purge.mock.calls.length).toBe(calls);
  });

  test('logs a failed sweep and keeps going', async () => {
    const error = vi.spyOn(logger, 'error');
    const context = setup();
    const purge = vi.spyOn(context.store, 'purge').mockRejectedValueOnce(new Error('db down'));

    const purger = startPurger({ intervalMs: 1, retention, store: context.store });
    await vi.waitFor(() => {
      expect(purge.mock.calls.length).toBeGreaterThan(2);
    });
    await purger.stop();

    expect(error).toHaveBeenCalledWith('Job purge failed', expect.anything());
  });

  test('stop waits for a sweep that is in progress', async () => {
    const context = setup();
    const { promise: release, resolve } = Promise.withResolvers<number>();
    const { promise: started, resolve: onStart } = Promise.withResolvers<undefined>();
    vi.spyOn(context.store, 'purge').mockImplementation(async () => {
      onStart(undefined);
      return await release;
    });

    const purger = startPurger({ intervalMs: 1000, retention, store: context.store });
    await started;
    const stopped = purger.stop();
    resolve(0);

    await expect(stopped).resolves.toBeUndefined();
  });
});
