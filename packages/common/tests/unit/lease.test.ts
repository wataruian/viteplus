import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test';

import {
  type LeaseHeartbeatOptions,
  type LeaseLoss,
  leaseReserveMs,
  startLeaseHeartbeat,
} from '../../src/utils/lease';

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

const start = (
  renew: LeaseHeartbeatOptions['renew'],
  overrides: Partial<LeaseHeartbeatOptions> = {},
) => {
  const lost: LeaseLoss[] = [];
  const errors: unknown[] = [];
  const stop = startLeaseHeartbeat({
    heldSince: Date.now(),
    intervalMs: 15,
    leaseMs: 60,
    onLost: (reason) => {
      lost.push(reason);
    },
    onRenewError: (error) => {
      errors.push(error);
    },
    renew,
    reserveMs: leaseReserveMs(15, 5, 5),
    ...overrides,
  });
  return { errors, lost, stop };
};

const renewal = (held: boolean) => vi.fn(async () => await Promise.resolve(held));

describe('leaseReserveMs', () => {
  test('is one interval, the abort grace and a margin capped at half an interval', () => {
    expect(leaseReserveMs(15_000, 5000, 5000)).toBe(25_000);
    expect(leaseReserveMs(7500, 5000, 1000)).toBe(13_500);
    expect(leaseReserveMs(100, 10, 1000)).toBe(160);
  });
});

describe('startLeaseHeartbeat', () => {
  test('renews every interval and keeps the lease while renewals succeed', async () => {
    const renew = renewal(true);
    const { lost, stop } = start(renew);

    await vi.advanceTimersByTimeAsync(300);
    stop();

    expect(renew).toHaveBeenCalledTimes(20);
    expect(lost).toStrictEqual([]);
  });

  test('rides out one failed renewal, and gives up before the lease ends after two', async () => {
    const renew = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValue(true)
      .mockRejectedValueOnce(new Error('blip'));
    const first = start(renew);

    await vi.advanceTimersByTimeAsync(45);
    first.stop();
    expect(first.lost).toStrictEqual([]);
    expect(first.errors).toHaveLength(1);

    const failing = vi.fn<() => Promise<boolean>>().mockRejectedValue(new Error('down'));
    const second = start(failing);
    await vi.advanceTimersByTimeAsync(45);
    expect(second.lost).toStrictEqual(['expiring']);
    expect(failing).toHaveBeenCalledTimes(2);
  });

  test('reports a takeover once and stops', async () => {
    const renew = renewal(false);
    const { lost } = start(renew);

    await vi.advanceTimersByTimeAsync(100);

    expect(lost).toStrictEqual(['taken-over']);
    expect(renew).toHaveBeenCalledOnce();
  });

  test('sends one renewal at a time', async () => {
    const pending = Promise.withResolvers<boolean>();
    const renew = vi.fn(async () => await pending.promise);
    const { stop } = start(renew, { leaseMs: 1000 });

    await vi.advanceTimersByTimeAsync(100);
    expect(renew).toHaveBeenCalledOnce();
    pending.resolve(true);
    await vi.advanceTimersByTimeAsync(15);
    stop();

    expect(renew).toHaveBeenCalledTimes(2);
  });

  test('ignores a renewal that settles after the heartbeat stopped', async () => {
    const answer = Promise.withResolvers<boolean>();
    const { errors, lost, stop } = start(
      vi.fn<() => Promise<boolean>>().mockReturnValueOnce(answer.promise),
      { leaseMs: 1000 },
    );

    await vi.advanceTimersByTimeAsync(15);
    stop();
    answer.resolve(false);
    await vi.advanceTimersByTimeAsync(0);

    expect(lost).toStrictEqual([]);
    expect(errors).toStrictEqual([]);
  });

  test('ignores a renewal error that arrives after the heartbeat stopped', async () => {
    const failure = Promise.withResolvers<boolean>();
    const { errors, stop } = start(
      vi.fn<() => Promise<boolean>>().mockReturnValueOnce(failure.promise),
      { leaseMs: 1000 },
    );

    await vi.advanceTimersByTimeAsync(15);
    stop();
    failure.reject(new Error('late'));
    await vi.advanceTimersByTimeAsync(0);

    expect(errors).toStrictEqual([]);
  });

  test('times the lease with the injected clock', async () => {
    let now = 0;
    const renew = renewal(true);
    const { lost } = start(renew, {
      clock: () => now,
    });

    now = 1000;
    await vi.advanceTimersByTimeAsync(15);

    expect(lost).toStrictEqual(['expiring']);
    expect(renew).not.toHaveBeenCalled();
  });
});
