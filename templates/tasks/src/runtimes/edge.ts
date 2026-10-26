import type { ExecutionContext, ScheduledController } from '@cloudflare/workers-types/index.ts';
import { logger } from '@lightproject/common/logger';
import { flushTelemetry } from '@lightproject/common/server';

import { config } from '../config';
import { cronTickMs, isPurgeDue, purgeFinished } from '../core/retention';
import { functions } from '../functions';
import { startTelemetry } from './telemetry';
import { type EdgeEnv, type Slot, loopName, openSharedStore } from './worker-loop';

config.assertKnownFunctions(functions);

const handler = {
  async scheduled(controller: ScheduledController, env: EdgeEnv, ctx: ExecutionContext) {
    const slots = functions.flatMap((definition) =>
      Array.from({ length: config.concurrencyFor(definition) }, (_, index): Slot => ({
        functionName: definition.name,
        index,
      })),
    );

    try {
      await startTelemetry();
      const results = await Promise.allSettled(
        slots.map(async (slot) => {
          const loop = env.WORKER_LOOP.get(env.WORKER_LOOP.idFromName(loopName(slot)));
          await loop.fetch('https://worker-loop/start', {
            body: JSON.stringify(slot),
            method: 'POST',
          });
        }),
      );
      for (const { reason } of results.filter((result) => result.status === 'rejected')) {
        logger.error('Failed to start a worker loop', { error: reason });
      }
      logger.info(`Cron ${controller.cron}: ${slots.length} worker loop(s) running`);

      if (isPurgeDue(controller.scheduledTime, config.purgeIntervalMs, cronTickMs)) {
        const store = await openSharedStore(env);
        try {
          await purgeFinished({ ...config.purge, retention: config.retention, store });
        } finally {
          await store.close();
        }
      }
    } catch (error) {
      logger.error('Cron watchdog failed', { error });
    } finally {
      ctx.waitUntil(flushTelemetry());
    }
  },
};

export { WorkerLoop } from './worker-loop';
export type { EdgeEnv } from './worker-loop';

export default handler;
