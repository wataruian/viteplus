import { describe, expect, test } from 'vite-plus/test';

import {
  abortGraceMs,
  abortMarginMs,
  minLeaseMs,
  shutdownGraceMs,
  telemetryFlushMs,
} from '../../../src/core/timing';

describe('lease timing', () => {
  test('the shortest lease leaves two heartbeats before the abort reserve', () => {
    const intervalMs = minLeaseMs / 4;
    const reserveMs = intervalMs + abortGraceMs + Math.min(abortMarginMs, intervalMs / 2);

    expect(2 * intervalMs + reserveMs).toBeLessThan(minLeaseMs);
  });
});

describe('shutdown timing', () => {
  test('the default stop fits a 30 s orchestrator timeout with a second left to close the store', () => {
    const threadAbortMs = abortGraceMs;
    const threadFlushMs = abortGraceMs;

    expect(shutdownGraceMs + threadAbortMs + threadFlushMs + telemetryFlushMs).toBeLessThan(
      30_000 - 1000,
    );
  });
});
