import { describe, expect, test } from 'vite-plus/test';

import { createIdleBackoff, nextIdleDelay } from '../../../src/core/loop';

describe('nextIdleDelay', () => {
  const backoff = { maxMs: 30_000, minMs: 1000 };

  test('starts at the minimum, doubles while idle, and stops at the maximum', () => {
    const delays: number[] = [];
    let delay: number | undefined = undefined;
    for (let step = 0; step < 7; step += 1) {
      delay = nextIdleDelay(delay, backoff);
      delays.push(delay);
    }

    expect(delays).toStrictEqual([1000, 2000, 4000, 8000, 16_000, 30_000, 30_000]);
  });

  test('never goes below the minimum', () => {
    expect(nextIdleDelay(100, backoff)).toBe(1000);
  });

  test('never polls faster than the minimum, even when the maximum is lower', () => {
    const inverted = { maxMs: 1000, minMs: 5000 };

    expect([nextIdleDelay(undefined, inverted), nextIdleDelay(5000, inverted)]).toStrictEqual([
      5000, 5000,
    ]);
  });
});

describe('createIdleBackoff', () => {
  test('backs off on each call and starts over after a reset', () => {
    const backoff = createIdleBackoff({ maxMs: 4000, minMs: 1000 });

    expect([backoff.next(), backoff.next(), backoff.next(), backoff.next()]).toStrictEqual([
      1000, 2000, 4000, 4000,
    ]);
    backoff.reset();
    expect(backoff.next()).toBe(1000);
  });
});
