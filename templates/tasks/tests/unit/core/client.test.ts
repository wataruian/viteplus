import { describe, expect, expectTypeOf, test } from 'vite-plus/test';
import { z } from 'zod';

import type { EnqueueOptions } from '../../../src/core/client';
import { defineFunction } from '../../../src/core/function';
import { setup } from '../helpers/jobs';

describe('createJobClient', () => {
  test('enqueues a validated payload with the function defaults', async () => {
    const { client, definition, time } = setup({ maxAttempts: 4 });

    const job = await client.enqueue(definition, { value: 7 });

    expect(job).toMatchObject({
      attempts: 0,
      functionName: 'test',
      maxAttempts: 4,
      payload: { value: 7 },
      runAt: new Date(time.clock()),
      status: 'pending',
    });
  });

  test('applies delayMs, runAt, maxAttempts and dedupeKey', async () => {
    const { client, definition, time } = setup();

    const delayed = await client.enqueue(
      definition,
      { value: 1 },
      { delayMs: 500, maxAttempts: 2 },
    );
    const scheduled = await client.enqueue(
      definition,
      { value: 1 },
      { dedupeKey: 'k', runAt: new Date(42) },
    );
    const duplicate = await client.enqueue(definition, { value: 2 }, { dedupeKey: 'k' });

    expect(delayed).toMatchObject({
      dedupeKey: null,
      maxAttempts: 2,
      runAt: new Date(time.clock() + 500),
    });
    expect(scheduled).toMatchObject({ dedupeKey: 'k', runAt: new Date(42) });
    expect(duplicate.id).toBe(scheduled.id);
  });

  test('accepts delayMs or runAt, but not both', () => {
    expectTypeOf<{ delayMs: number }>().toExtend<EnqueueOptions>();
    expectTypeOf<{ runAt: Date }>().toExtend<EnqueueOptions>();
    expectTypeOf<{ delayMs: number; runAt: Date }>().not.toExtend<EnqueueOptions>();
  });

  test('rejects a payload that does not match the schema', async () => {
    const { client } = setup();
    const loose = defineFunction<{ value: number | string }>({
      handler: async () => {
        await Promise.resolve();
      },
      name: 'loose',
      schema: z.object({ value: z.number() }),
    });

    await expect(client.enqueue(loose, { value: 'x' })).rejects.toThrow(z.ZodError);
  });

  test('rejects a payload that does not survive JSON storage', async () => {
    const { client } = setup();
    const dated = defineFunction({
      handler: async () => {
        await Promise.resolve();
      },
      name: 'dated',
      schema: z.object({ at: z.date() }),
    });

    await expect(client.enqueue(dated, { at: new Date(0) })).rejects.toThrow(
      'Function "dated": payload does not survive JSON storage',
    );
  });

  test.each([
    [{ maxAttempts: 0 }, 'Function "test": maxAttempts must be a positive integer, got 0'],
    [{ maxAttempts: 1.5 }, 'Function "test": maxAttempts must be a positive integer, got 1.5'],
    [{ delayMs: -1 }, 'Function "test": delayMs must be a non-negative number'],
    [{ delayMs: Number.NaN }, 'Function "test": delayMs must be a non-negative number'],
    [{ runAt: new Date(Number.NaN) }, 'Function "test": runAt must be a valid date'],
    [{ delayMs: 1e16 }, 'Function "test": delayMs is too large'],
  ])('rejects invalid options %o', async (options, message) => {
    const { client, definition } = setup();

    await expect(client.enqueue(definition, { value: 1 }, options)).rejects.toThrow(message);
  });
});
