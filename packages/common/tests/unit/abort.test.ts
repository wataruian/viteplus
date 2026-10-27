import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { raceAbort, settleWithin } from '../../src/utils/abort';
import { sleep } from '../../src/utils/time';

class TestAbortError extends Error {
  public readonly settled: boolean;

  public constructor(settled: boolean) {
    super('aborted');
    this.name = 'TestAbortError';
    this.settled = settled;
  }
}

const options = { abortError: (settled: boolean) => new TestAbortError(settled) };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('settleWithin', () => {
  test('is true once the promise resolves or rejects in time', async () => {
    await expect(settleWithin(Promise.resolve(1), 10)).resolves.toBe(true);
    await expect(settleWithin(Promise.reject(new Error('x')), 10)).resolves.toBe(true);
  });

  test('is false when the grace passes first', async () => {
    await expect(settleWithin(Promise.withResolvers<undefined>().promise, 5)).resolves.toBe(false);
  });
});

describe('raceAbort', () => {
  test('resolves with the promise when not aborted', async () => {
    await expect(
      raceAbort(Promise.resolve(1), new globalThis.AbortController().signal, options),
    ).resolves.toBe(1);
  });

  test('passes a rejection through when not aborted', async () => {
    await expect(
      raceAbort(
        Promise.reject(new Error('boom')),
        new globalThis.AbortController().signal,
        options,
      ),
    ).rejects.toThrow('boom');
  });

  test('throws the abort error at once when already aborted', async () => {
    await expect(
      raceAbort(Promise.resolve(1), globalThis.AbortSignal.abort(), options),
    ).rejects.toMatchObject({ name: 'TestAbortError', settled: true });
  });

  test('throws on abort and swallows a later rejection of the promise', async () => {
    const controller = new globalThis.AbortController();
    const { promise, reject } = Promise.withResolvers<number>();
    const raced = raceAbort(promise, controller.signal, options);

    controller.abort();
    reject(new Error('late'));
    await expect(raced).rejects.toMatchObject({ name: 'TestAbortError', settled: true });
    await sleep();
  });

  test('waits for aborted work that settles within the grace', async () => {
    const controller = new globalThis.AbortController();
    let settled = false;
    const work = sleep(30).then(() => {
      settled = true;
    });
    const raced = raceAbort(work, controller.signal, { ...options, graceMs: 1000 });

    controller.abort();
    await expect(raced).rejects.toMatchObject({ settled: true });
    expect(settled).toBe(true);
  });

  test('gives up on work that outlives the grace and reports it', async () => {
    const unsettled: number[] = [];
    const controller = new globalThis.AbortController();
    const raced = raceAbort(Promise.withResolvers<undefined>().promise, controller.signal, {
      ...options,
      graceMs: 20,
      onUnsettled: (graceMs) => {
        unsettled.push(graceMs);
      },
    });

    controller.abort();
    await expect(raced).rejects.toMatchObject({ settled: false });
    expect(unsettled).toStrictEqual([20]);
  });

  test('ignores an unsettled report without a callback', async () => {
    const controller = new globalThis.AbortController();
    const raced = raceAbort(Promise.withResolvers<undefined>().promise, controller.signal, options);

    controller.abort();
    await expect(raced).rejects.toMatchObject({ settled: false });
  });
});
