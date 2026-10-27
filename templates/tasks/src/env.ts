import {
  strictFlag as flag,
  readRuntimeEnv,
  serverEnvOptions,
} from '@lightproject/common/environment';
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

import { maxTimerMs, minLeaseMs, shutdownGraceMs } from './core/timing';
import { jobStoreKinds } from './stores';

const day = 24 * 60 * 60 * 1000;

const concurrencyOverrides = z
  .string()
  .optional()
  .transform((value, context) => {
    const overrides = new Map<string, number>();
    for (const entry of (value ?? '').split(',').map((part) => part.trim())) {
      const separator = entry.indexOf('=');
      const name = entry.slice(0, separator).trim();
      const count = entry.slice(separator + 1).trim();
      if (separator > 0 && /^[^=\s]+$/u.test(name) && /^[1-9]\d*$/u.test(count)) {
        overrides.set(name, Number(count));
      } else if (entry !== '') {
        context.addIssue({
          code: 'custom',
          message: 'must be comma-separated <function>=<positive integer> pairs',
        });
      }
    }
    return overrides;
  });

const server = {
  JOB_PURGE_BATCH_SIZE: z.coerce.number().int().positive().default(500),
  JOB_PURGE_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(maxTimerMs)
    .default(60 * 60 * 1000),
  JOB_PURGE_MAX_BATCHES: z.coerce.number().int().positive().default(20),
  JOB_RETENTION_DEAD_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * day),
  JOB_RETENTION_SUCCEEDED_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * day),
  JOB_STORE: z.enum(jobStoreKinds),
  SKIP_OPENTELEMETRY: flag.default(false),
  TASKS_CONCURRENCY: concurrencyOverrides,
  WORKER_IDLE_POLL_MAX_MS: z.coerce.number().int().positive().max(maxTimerMs).default(30_000),
  WORKER_LEASE_MS: z.coerce.number().int().min(minLeaseMs).max(maxTimerMs).default(minLeaseMs),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().max(maxTimerMs).default(1000),
  WORKER_SHUTDOWN_GRACE_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .max(maxTimerMs)
    .default(shutdownGraceMs),
};

const env = createEnv({
  ...serverEnvOptions,
  isServer: true,
  runtimeEnv: readRuntimeEnv(server),
  server,
});

export { concurrencyOverrides, day, env, server };
