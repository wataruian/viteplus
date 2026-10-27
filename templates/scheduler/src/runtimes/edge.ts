import type { ExecutionContext, ScheduledController } from '@cloudflare/workers-types/index.ts';
import { logger } from '@lightproject/common/logger';
import { flushTelemetry } from '@lightproject/common/server';
import { db } from '@lightproject/datastore';

import { cronCapWarnings, cronMaxRunMs } from '../core/cloudflare';
import { handleRunRequest } from '../core/http';
import { type RunOutcome, runScript } from '../core/runner';
import { scriptsFor } from '../core/script';
import { scripts } from '../scripts';
import { serviceName, startTelemetry } from './telemetry';

type EdgeContext = Pick<ExecutionContext, 'waitUntil'>;

interface EdgeEnv extends db.DatabaseEnv {
  SCHEDULER_RUN_TOKEN?: string;
}

for (const warning of cronCapWarnings(scripts)) {
  logger.warn(warning);
}

const okOutcomes: ReadonlySet<RunOutcome> = new Set(['succeeded', 'skipped']);

const handler = {
  async fetch(request: Request, env: EdgeEnv, ctx: EdgeContext): Promise<Response> {
    const flush = { byRun: false };
    try {
      await startTelemetry();
      return await handleRunRequest(request, {
        run: async (script, input) => {
          const running = runScript(script, {
            input,
            lockScope: serviceName,
            openDatabase: async () => await db.createDatabase(env),
            signal: request.signal,
            trigger: 'manual',
          });
          flush.byRun = true;
          ctx.waitUntil(running.then(flushTelemetry, flushTelemetry));
          return await running;
        },
        scripts,
        token: env.SCHEDULER_RUN_TOKEN,
      });
    } finally {
      if (!flush.byRun) {
        ctx.waitUntil(flushTelemetry());
      }
    }
  },

  async scheduled(controller: ScheduledController, env: EdgeEnv, ctx: EdgeContext) {
    try {
      await startTelemetry();
      const due = scriptsFor(scripts, controller.cron);
      if (due.length === 0) {
        logger.warn(`Cron ${controller.cron} matches no script; check wrangler.toml [triggers]`);
        return;
      }
      const results = await Promise.allSettled(
        due.map(
          async (script) =>
            await runScript(script, {
              input: {},
              lockScope: serviceName,
              maxRunMs: cronMaxRunMs,
              openDatabase: async () => await db.createDatabase(env),
              scheduledTime: new Date(controller.scheduledTime),
              trigger: 'schedule',
            }),
        ),
      );
      const failed = due.filter((_script, index) => {
        const result = results[index];
        return result.status === 'rejected' || !okOutcomes.has(result.value.outcome);
      });
      if (failed.length > 0) {
        controller.noRetry();
        throw new Error(
          `Cron ${controller.cron}: ${failed.map(({ name }) => name).join(', ')} failed`,
        );
      }
    } finally {
      ctx.waitUntil(flushTelemetry());
    }
  },
};

export type { EdgeContext, EdgeEnv };

export default handler;
