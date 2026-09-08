import { describe, expect, test, vi } from 'vite-plus/test';

import { eternalSleep, reduceWaitingTimeByTwoBlocks, sleep, withRetry } from '../src/utils/time';

describe('reduceWaitingTimeByTwoBlocks', () => {
  test('subtracts 6000ms from the waiting time', () => {
    expect(reduceWaitingTimeByTwoBlocks(70_000)).toBe(64_000);
  });

  test('never returns less than the 60000ms floor', () => {
    expect(reduceWaitingTimeByTwoBlocks(1000)).toBe(60_000);
    expect(reduceWaitingTimeByTwoBlocks(0)).toBe(60_000);
  });
});

describe('sleep', () => {
  test('resolves after the given number of milliseconds', async () => {
    vi.useFakeTimers();
    const promise = sleep(1000);
    let resolved = false;
    promise
      .then(() => {
        resolved = true;
      })
      .catch(() => {});

    await vi.advanceTimersByTimeAsync(999);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(resolved).toBe(true);

    vi.useRealTimers();
  });
});

describe('eternalSleep', () => {
  test('never resolves', async () => {
    const result = await Promise.race([
      eternalSleep().then(() => 'resolved'),
      Promise.resolve('raced'),
    ]);
    expect(result).toBe('raced');
  });
});

describe('withRetry', () => {
  test('returns the result immediately when the operation succeeds on the first try', async () => {
    const operation = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(operation);
    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test('retries on failure and eventually succeeds', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const operation = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) {
        await Promise.reject(new Error('not yet'));
      }
      return 'ok';
    });

    const resultPromise = withRetry(operation, 5, 10);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  test('throws the last error once retries are exhausted', async () => {
    vi.useFakeTimers();
    const error = new Error('always fails');
    const operation = vi.fn().mockRejectedValue(error);

    const resultPromise = withRetry(operation, 2, 10);
    const expectation = expect(resultPromise).rejects.toThrow(error);
    await vi.runAllTimersAsync();
    await expectation;

    expect(operation).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
