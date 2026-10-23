import type {
  DurableObjectNamespace,
  DurableObjectState,
} from '@cloudflare/workers-types/index.ts';
import { logger } from '@lightproject/common/logger';
import { flushTelemetry } from '@lightproject/common/server';
import { getServiceInstanceId } from '@lightproject/common/utils';
import type { db } from '@lightproject/database';
import { z } from 'zod';

import { config } from '../config';
import type { JobFunction } from '../core/function';
import { createIdleBackoff } from '../core/loop';
import { workerIdFor } from '../core/pool';
import { createInProcessExecutor, drain } from '../core/runner';
import { functions } from '../functions';
import { createJobStore } from '../stores';
import { startTelemetry } from './telemetry';

interface EdgeEnv extends db.DatabaseEnv {
  WORKER_LOOP: DurableObjectNamespace;
}

const slotSchema = z.object({ functionName: z.string(), index: z.number().int().nonnegative() });

type Slot = z.infer<typeof slotSchema>;

const slotKey = 'slot';

const alarmBudgetMs = 30_000;

const loopName = ({ functionName, index }: Slot) => `${functionName}#${index + 1}`;

const openSharedStore = async (env: EdgeEnv) => {
  if (config.jobStore === 'memory') {
    throw new Error(
      'JOB_STORE=memory cannot run on Cloudflare: each Durable Object would get its own queue. Use JOB_STORE=database.',
    );
  }
  return await createJobStore(config.jobStore, env);
};

const activeDefinition = (slot: Slot): JobFunction | undefined => {
  const definition = functions.find(({ name }) => name === slot.functionName);
  return definition !== undefined && slot.index < config.concurrencyFor(definition)
    ? definition
    : undefined;
};

class WorkerLoop {
  private readonly state: DurableObjectState;
  private readonly env: EdgeEnv;
  private readonly backoff = createIdleBackoff({
    maxMs: config.idlePollMaxMs,
    minMs: config.pollIntervalMs,
  });

  public constructor(state: DurableObjectState, env: EdgeEnv) {
    this.state = state;
    this.env = env;
  }

  public async fetch(request: Request): Promise<Response> {
    const slot = slotSchema.parse(await request.json());
    if (!slotSchema.safeParse(await this.state.storage.get(slotKey)).success) {
      await this.state.storage.put(slotKey, slot);
    }
    if ((await this.state.storage.getAlarm()) === null) {
      await this.state.storage.setAlarm(Date.now());
    }
    return new globalThis.Response(null, { status: 204 });
  }

  public async alarm(): Promise<void> {
    const { storage } = this.state;
    const slot = slotSchema.safeParse(await storage.get(slotKey));
    const definition = slot.success ? activeDefinition(slot.data) : undefined;
    if (!slot.success || definition === undefined) {
      await storage.deleteAll();
      return;
    }

    let nextAlarmAt = Date.now() + config.pollIntervalMs;
    let produced = false;
    try {
      await startTelemetry();
      const store = await openSharedStore(this.env);
      try {
        const deadline = Date.now() + alarmBudgetMs;
        const processed = await drain({
          deadline,
          definition,
          execute: createInProcessExecutor(functions),
          leaseMs: config.leaseMs,
          store,
          workerId: workerIdFor(definition, slot.data.index, getServiceInstanceId()),
        });
        produced = processed > 0;
        if (produced) {
          this.backoff.reset();
        }
        const finishedAt = Date.now();
        nextAlarmAt =
          finishedAt >= deadline
            ? finishedAt
            : finishedAt + (produced ? config.pollIntervalMs : this.backoff.next());
      } finally {
        await store.close();
      }
    } catch (error) {
      produced = true;
      nextAlarmAt = Date.now() + this.backoff.next();
      logger.error('Worker loop failed', { error, loop: loopName(slot.data) });
    } finally {
      await storage.setAlarm(nextAlarmAt);
      if (produced) {
        await flushTelemetry();
      }
    }
  }
}

export {
  activeDefinition,
  alarmBudgetMs,
  loopName,
  openSharedStore,
  slotKey,
  slotSchema,
  WorkerLoop,
};
export type { EdgeEnv, Slot };
