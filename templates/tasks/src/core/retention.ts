import { logger } from '@lightproject/common/logger';

import { startLoop } from './loop';
import type { Clock, FinishedStatus, JobStore } from './store';

interface Retention {
  succeededMs: number;
  deadMs: number;
}

interface PurgeOptions {
  store: JobStore;
  retention: Retention;
  clock?: Clock;
  batchSize?: number;
  maxBatches?: number;
}

interface PurgerOptions extends PurgeOptions {
  intervalMs: number;
}

interface Purger {
  stop: () => Promise<void>;
}

type PurgeCounts = Record<FinishedStatus, number>;

interface StatusSweep {
  store: JobStore;
  status: FinishedStatus;
  updatedBefore: number;
  batchSize: number;
  batchesLeft: number;
}

const sweepStatus = async (sweep: StatusSweep): Promise<number> => {
  const { batchSize, batchesLeft, status, store, updatedBefore } = sweep;
  let total = 0;
  for (let batch = 0; batch < Math.max(1, batchesLeft); batch += 1) {
    const deleted = await store.purge({
      limit: batchSize,
      status,
      updatedBefore: new Date(updatedBefore),
    });
    total += deleted;
    if (deleted < batchSize) {
      break;
    }
  }
  return total;
};

const purgeFinished = async (options: PurgeOptions): Promise<PurgeCounts> => {
  const { batchSize = 500, clock = Date.now, maxBatches = 20, retention, store } = options;
  const now = clock();
  const [succeeded, dead] = await Promise.all([
    sweepStatus({
      batchSize,
      batchesLeft: maxBatches,
      status: 'succeeded',
      store,
      updatedBefore: now - retention.succeededMs,
    }),
    sweepStatus({
      batchSize,
      batchesLeft: maxBatches,
      status: 'dead',
      store,
      updatedBefore: now - retention.deadMs,
    }),
  ]);
  if (succeeded + dead > 0) {
    logger.info(`Purged ${succeeded} succeeded and ${dead} dead job(s)`);
  }
  return { dead, succeeded };
};

const cronTickMs = 60_000;

const isPurgeDue = (scheduledTime: number, intervalMs: number, tickMs: number) =>
  Math.floor(scheduledTime / intervalMs) !== Math.floor((scheduledTime - tickMs) / intervalMs);

const startPurger = (options: PurgerOptions): Purger => {
  const { intervalMs } = options;
  return startLoop(
    async () => {
      await purgeFinished(options);
      return intervalMs;
    },
    (error) => {
      logger.error('Job purge failed', { error });
      return intervalMs;
    },
  );
};

export { cronTickMs, isPurgeDue, purgeFinished, startPurger, sweepStatus };
export type { PurgeCounts, PurgeOptions, Purger, PurgerOptions, Retention, StatusSweep };
