import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { startPool, workerIdFor } from '../../../src/core/pool';
import { createInProcessExecutor } from '../../../src/core/runner';
import { setup, testFunction } from '../helpers/jobs';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('startPool', () => {
  test('starts `concurrency` workers per function with unique ids', async () => {
    const { store } = setup();
    const functions = [testFunction({ concurrency: 2 }), testFunction({ name: 'other' })];
    const createExecutor = vi.fn(() => createInProcessExecutor(functions));

    const pool = startPool({
      createExecutor,
      functions,
      idlePollMaxMs: 20,
      instanceId: 'host',
      leaseMs: 1000,
      pollIntervalMs: 5,
      store,
    });
    await pool.stop();

    expect(pool.workers.map(({ workerId }) => workerId)).toStrictEqual([
      'test#1@host',
      'test#2@host',
      'other#1@host',
    ]);
    expect(createExecutor).toHaveBeenCalledTimes(3);
  });

  test('honors a concurrency override', async () => {
    const { store } = setup();
    const functions = [testFunction()];

    const pool = startPool({
      concurrency: () => 3,
      createExecutor: () => createInProcessExecutor(functions),
      functions,
      idlePollMaxMs: 20,
      instanceId: 'host',
      leaseMs: 1000,
      pollIntervalMs: 5,
      store,
    });
    await pool.stop();

    expect(pool.workers).toHaveLength(3);
  });

  test('rejects duplicate function names', () => {
    const { store } = setup();
    const functions = [testFunction(), testFunction()];

    expect(() =>
      startPool({
        createExecutor: () => createInProcessExecutor(functions),
        functions,
        idlePollMaxMs: 20,
        instanceId: 'host',
        leaseMs: 1000,
        pollIntervalMs: 5,
        store,
      }),
    ).toThrow('Duplicate job function name');
  });

  test('runs jobs of one function in parallel and isolates a failing job', async () => {
    let running = 0;
    let peak = 0;
    const context = setup({
      concurrency: 3,
      handler: async ({ value }) => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => {
          globalThis.setTimeout(resolve, 20);
        });
        running -= 1;
        if (value === 0) {
          throw new Error('bad job');
        }
      },
      maxAttempts: 1,
    });
    const jobs = await Promise.all(
      [0, 1, 2].map(async (value) => await context.client.enqueue(context.definition, { value })),
    );

    const pool = startPool({
      createExecutor: () => createInProcessExecutor([context.definition]),
      functions: [context.definition],
      idlePollMaxMs: 20,
      instanceId: 'host',
      leaseMs: 1000,
      pollIntervalMs: 5,
      store: context.store,
    });
    await vi.waitFor(async () => {
      const statuses = await Promise.all(
        jobs.map(async ({ id }) => {
          const job = await context.store.findById(id);
          return job?.status;
        }),
      );
      expect(statuses).toStrictEqual(['dead', 'succeeded', 'succeeded']);
    });
    await pool.stop();

    expect(peak).toBe(3);
  });

  test('releases in-flight jobs when the shutdown grace runs out', async () => {
    const context = setup({
      handler: async (_payload, { signal }) => {
        await new Promise((resolve) => {
          signal.addEventListener('abort', resolve);
        });
      },
    });
    const job = await context.client.enqueue(context.definition, { value: 1 });
    const pool = startPool({
      createExecutor: () => createInProcessExecutor([context.definition]),
      functions: [context.definition],
      idlePollMaxMs: 20,
      instanceId: 'host',
      leaseMs: 1000,
      pollIntervalMs: 5,
      store: context.store,
    });
    await vi.waitFor(async () => {
      await expect(context.store.findById(job.id)).resolves.toMatchObject({ status: 'running' });
    });

    await pool.stop({ graceMs: 20 });

    await expect(context.store.findById(job.id)).resolves.toMatchObject({
      attempts: 0,
      status: 'pending',
    });
  });
});

describe('workerIdFor', () => {
  test('combines function, index and instance', () => {
    expect(workerIdFor(testFunction(), 0, 'abc')).toBe('test#1@abc');
  });
});
