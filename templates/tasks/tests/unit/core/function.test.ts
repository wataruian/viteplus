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

describe('exponentialBackoff', () => {
  test('doubles per attempt with equal jitter and caps at maxMs', () => {
    const backoff = exponentialBackoff({ baseMs: 100, maxMs: 1000 });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect([1, 2, 3, 4, 5].map((attempt) => backoff(attempt))).toStrictEqual([
      50, 100, 200, 400, 500,
    ]);

    vi.spyOn(Math, 'random').mockReturnValue(1);
    expect([0, 1, 2, 5].map((attempt) => backoff(attempt))).toStrictEqual([100, 100, 200, 1000]);
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
