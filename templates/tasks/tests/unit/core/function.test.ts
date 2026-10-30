import { logger } from '@lightproject/common/logger';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { z } from 'zod';

import {
  UnrecoverableJobError,
  assertUniqueNames,
  defineFunction,
  exponentialBackoff,
} from '../../../src/core/function';
import { setup, testFunction } from '../helpers/jobs';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('defineFunction', () => {
  test('applies defaults', () => {
    const definition = defineFunction({
      handler: async () => {
        await Promise.resolve();
      },
      name: 'defaults',
      schema: z.object({}),
    });

    expect(definition).toMatchObject({
      concurrency: 1,
      maxAttempts: 5,
      name: 'defaults',
      timeoutMs: 60_000,
    });
    expect(definition.backoff(1)).toBeGreaterThanOrEqual(500);
  });

  test.each([
    ['concurrency', { concurrency: 0 }],
    ['maxAttempts', { maxAttempts: 1.5 }],
    ['timeoutMs', { timeoutMs: -1 }],
  ])('rejects a non-positive-integer %s', (key, overrides) => {
    expect(() => testFunction(overrides)).toThrow(
      `Function "test": ${key} must be a positive integer`,
    );
  });

  test('rejects a timeout beyond what a timer can hold', () => {
    expect(() => testFunction({ timeoutMs: 2_147_483_648 })).toThrow(
      'Function "test": timeoutMs must be at most 2147483647, got 2147483648',
    );
  });

  test('execute validates the payload before calling the handler', async () => {
    const handler = vi.fn(async () => {
      await Promise.resolve();
    });
    const { client, definition: base } = setup();
    const definition = testFunction({ handler });
    const job = await client.enqueue(base, { value: 1 });
    const context = {
      attempt: 1,
      idempotencyKey: job.id,
      job,
      logger,
      signal: new globalThis.AbortController().signal,
      skip: () => {},
      withTrace: <R>(fn: () => R) => fn(),
    };

    await definition.execute({ value: 1 }, context);
    const rejection = await definition.execute({ value: 'nope' }, context).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(rejection).toBeInstanceOf(UnrecoverableJobError);
    expect(rejection instanceof Error ? rejection.cause : undefined).toBeInstanceOf(z.ZodError);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ value: 1 }, context);
  });
});

const stubRandom = (...values: number[]) => {
  let call = 0;
  return vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
    if (array instanceof Uint32Array) {
      array.fill(values[Math.min(call, values.length - 1)] ?? 0);
      call += 1;
    }
    return array;
  });
};

describe('exponentialBackoff', () => {
  test('doubles per attempt with equal jitter and caps at maxMs', () => {
    const backoff = exponentialBackoff({ baseMs: 100, maxMs: 1000 });
    stubRandom(0);
    expect([1, 2, 3, 4, 5].map((attempt) => backoff(attempt))).toStrictEqual([
      50, 100, 200, 400, 500,
    ]);

    const upperBounds = [
      [1, 50, 100],
      [2, 100, 200],
      [5, 500, 1000],
    ] as const;
    for (const [attempt, jitter, delay] of upperBounds) {
      stubRandom(jitter);
      expect(backoff(attempt)).toBe(delay);
    }
  });

  test('redraws a value above the range instead of folding it in', () => {
    const backoff = exponentialBackoff({ baseMs: 100, maxMs: 1000 });
    const spy = stubRandom(63, 2 ** 32 - 1, 7);
    expect(backoff(1)).toBe(57);
    expect(spy).toHaveBeenCalledTimes(3);
  });
});

describe('assertUniqueNames', () => {
  test('throws on a duplicate function name', () => {
    expect(() => {
      assertUniqueNames([testFunction(), testFunction({ name: 'other' })]);
    }).not.toThrow();
    expect(() => {
      assertUniqueNames([testFunction(), testFunction()]);
    }).toThrow('Duplicate job function name: "test"');
  });
});
