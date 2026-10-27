import { logger } from '@lightproject/common/logger';

import { type JobFunction, assertUniqueNames } from './function';
import { type Executor, type RunningWorker, startWorker } from './runner';
import type { Clock, JobStore } from './store';

interface PoolOptions {
  store: JobStore;
  functions: readonly JobFunction[];
  createExecutor: (definition: JobFunction, workerId: string) => Executor;
  instanceId: string;
  leaseMs: number;
  pollIntervalMs: number;
  idlePollMaxMs: number;
  concurrency?: (definition: JobFunction) => number;
  clock?: Clock;
}

interface StopOptions {
  graceMs?: number;
}

interface WorkerPool {
  readonly workers: readonly RunningWorker[];
  stop: (options?: StopOptions) => Promise<void>;
}

const workerIdFor = (definition: JobFunction, index: number, instanceId: string) =>
  `${definition.name}#${index + 1}@${instanceId}`;

const startPool = (options: PoolOptions): WorkerPool => {
  const {
    concurrency = (definition: JobFunction) => definition.concurrency,
    createExecutor,
    functions,
    instanceId,
  } = options;
  assertUniqueNames(functions);
  const shutdown = new globalThis.AbortController();

  const workers = functions.flatMap((definition) =>
    Array.from({ length: concurrency(definition) }, (_, index) => {
      const workerId = workerIdFor(definition, index, instanceId);
      return startWorker({
        ...options,
        definition,
        execute: createExecutor(definition, workerId),
        shutdown: shutdown.signal,
        workerId,
      });
    }),
  );

  logger.info(`Started ${workers.length} worker(s) for ${functions.length} function(s)`, {
    workers: workers.map(({ workerId }) => workerId),
  });

  return {
    stop: async ({ graceMs }: StopOptions = {}) => {
      const deadline =
        graceMs === undefined
          ? undefined
          : globalThis.setTimeout(() => {
              logger.warn(`Shutdown grace of ${graceMs}ms elapsed; releasing in-flight jobs`);
              shutdown.abort();
            }, graceMs);
      await Promise.all(
        workers.map(async (worker) => {
          await worker.stop();
        }),
      );
      globalThis.clearTimeout(deadline);
    },
    workers,
  };
};

export { startPool, workerIdFor };
export type { PoolOptions, StopOptions, WorkerPool };
