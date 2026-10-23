import type { JobFunction } from './core/function';
import { env } from './env';

const config = {
  assertKnownFunctions(registered: readonly JobFunction[]) {
    const names = new Set(registered.map(({ name }) => name));
    const unknown = [...env.WORKER_CONCURRENCY.keys()].filter((name) => !names.has(name));
    if (unknown.length > 0) {
      throw new Error(`WORKER_CONCURRENCY names unknown function(s): ${unknown.join(', ')}`);
    }
  },
  concurrencyFor(definition: JobFunction) {
    return env.WORKER_CONCURRENCY.get(definition.name) ?? definition.concurrency;
  },
  get idlePollMaxMs() {
    return env.WORKER_IDLE_POLL_MAX_MS;
  },
  get jobStore() {
    return env.JOB_STORE;
  },
  get leaseMs() {
    return env.WORKER_LEASE_MS;
  },
  get pollIntervalMs() {
    return env.WORKER_POLL_INTERVAL_MS;
  },
  get purge() {
    return { batchSize: env.JOB_PURGE_BATCH_SIZE, maxBatches: env.JOB_PURGE_MAX_BATCHES };
  },
  get purgeIntervalMs() {
    return env.JOB_PURGE_INTERVAL_MS;
  },
  get retention() {
    return { deadMs: env.JOB_RETENTION_DEAD_MS, succeededMs: env.JOB_RETENTION_SUCCEEDED_MS };
  },
  get shutdownGraceMs() {
    return env.WORKER_SHUTDOWN_GRACE_MS;
  },
  get skipOpenTelemetry() {
    return env.SKIP_OPENTELEMETRY;
  },
};

export { config };
