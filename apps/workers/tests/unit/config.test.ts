import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { concurrencyOverrides } from '../../src/env';
import { testFunction } from './helpers/jobs';

afterEach(() => {
  vi.unstubAllEnvs();
});

const importConfig = async () => {
  vi.resetModules();
  const { config } = await import('../../src/config');
  return config;
};

describe('concurrencyOverrides', () => {
  test('parses name=count pairs and ignores blanks', () => {
    expect(concurrencyOverrides.parse(undefined)).toStrictEqual(new Map());
    expect(concurrencyOverrides.parse(' ping = 4 , ,send-email=2')).toStrictEqual(
      new Map([
        ['ping', 4],
        ['send-email', 2],
      ]),
    );
  });

  test.each([
    'ping=0',
    'ping=x',
    'ping',
    'ping=1.5',
    '=3',
    'ping=2=8',
    'ping=0x4',
    'ping=-1',
    'pi ng=2',
  ])('rejects %s', (value) => {
    expect(() => concurrencyOverrides.parse(value)).toThrow(
      'must be comma-separated <function>=<positive integer> pairs',
    );
  });
});

describe('config', () => {
  test('uses defaults', async () => {
    for (const key of [
      'JOB_PURGE_BATCH_SIZE',
      'JOB_PURGE_INTERVAL_MS',
      'JOB_PURGE_MAX_BATCHES',
      'JOB_RETENTION_DEAD_MS',
      'JOB_RETENTION_SUCCEEDED_MS',
      'WORKER_CONCURRENCY',
      'WORKER_IDLE_POLL_MAX_MS',
      'WORKER_LEASE_MS',
      'WORKER_POLL_INTERVAL_MS',
      'WORKER_SHUTDOWN_GRACE_MS',
    ]) {
      vi.stubEnv(key, undefined);
      vi.stubEnv(`VITE_${key}`, undefined);
    }
    vi.stubEnv('JOB_STORE', 'memory');
    const config = await importConfig();

    expect(config.jobStore).toBe('memory');
    expect(config.leaseMs).toBe(30_000);
    expect(config.pollIntervalMs).toBe(1000);
    expect(config.idlePollMaxMs).toBe(30_000);
    expect(config.shutdownGraceMs).toBe(15_000);
    expect(config.concurrencyFor(testFunction({ concurrency: 2 }))).toBe(2);
    expect(config.purge).toStrictEqual({ batchSize: 500, maxBatches: 20 });
    expect(config.purgeIntervalMs).toBe(3_600_000);
    expect(config.retention).toStrictEqual({ deadMs: 2_592_000_000, succeededMs: 604_800_000 });
  });

  test.each([undefined, '', 'postgres'])('rejects JOB_STORE=%s at startup', async (value) => {
    vi.stubEnv('JOB_STORE', value);
    vi.stubEnv('VITE_JOB_STORE', undefined);

    await expect(importConfig()).rejects.toThrow(/Invalid environment variables:[\s\S]*JOB_STORE/u);
  });

  test('rejects an invalid WORKER_CONCURRENCY at startup', async () => {
    vi.stubEnv('JOB_STORE', 'memory');
    vi.stubEnv('WORKER_CONCURRENCY', 'ping=0');

    await expect(importConfig()).rejects.toThrow(
      /Invalid environment variables:[\s\S]*WORKER_CONCURRENCY/u,
    );
  });

  test('rejects WORKER_CONCURRENCY names that match no registered function', async () => {
    vi.stubEnv('JOB_STORE', 'memory');
    vi.stubEnv('WORKER_CONCURRENCY', 'test=2,tset=3,pnig=1');
    const config = await importConfig();

    expect(() => {
      config.assertKnownFunctions([testFunction()]);
    }).toThrow('WORKER_CONCURRENCY names unknown function(s): tset, pnig');
    expect(() => {
      config.assertKnownFunctions([
        testFunction(),
        testFunction({ name: 'tset' }),
        testFunction({ name: 'pnig' }),
      ]);
    }).not.toThrow();
  });

  test('reads every variable', async () => {
    vi.stubEnv('JOB_PURGE_BATCH_SIZE', '1000');
    vi.stubEnv('JOB_PURGE_INTERVAL_MS', '60000');
    vi.stubEnv('JOB_PURGE_MAX_BATCHES', '50');
    vi.stubEnv('JOB_RETENTION_DEAD_MS', '2000');
    vi.stubEnv('JOB_RETENTION_SUCCEEDED_MS', '1000');
    vi.stubEnv('JOB_STORE', 'database');
    vi.stubEnv('SKIP_OPENTELEMETRY', 'true');
    vi.stubEnv('WORKER_CONCURRENCY', 'test=5');
    vi.stubEnv('WORKER_IDLE_POLL_MAX_MS', '400');
    vi.stubEnv('WORKER_LEASE_MS', '45000');
    vi.stubEnv('WORKER_POLL_INTERVAL_MS', '50');
    const config = await importConfig();

    expect({
      concurrency: config.concurrencyFor(testFunction()),
      idlePollMaxMs: config.idlePollMaxMs,
      jobStore: config.jobStore,
      leaseMs: config.leaseMs,
      pollIntervalMs: config.pollIntervalMs,
      purge: config.purge,
      purgeIntervalMs: config.purgeIntervalMs,
      retention: config.retention,
      skipOpenTelemetry: config.skipOpenTelemetry,
    }).toStrictEqual({
      concurrency: 5,
      idlePollMaxMs: 400,
      jobStore: 'database',
      leaseMs: 45_000,
      pollIntervalMs: 50,
      purge: { batchSize: 1000, maxBatches: 50 },
      purgeIntervalMs: 60_000,
      retention: { deadMs: 2000, succeededMs: 1000 },
      skipOpenTelemetry: true,
    });
  });
});
