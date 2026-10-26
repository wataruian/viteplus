import { generateUuid } from '@lightproject/common/utils';
import { z } from 'zod';

import { type TypedJobFunction, assertPositiveInteger } from './function';
import type { Job } from './job';
import type { Clock, JobStore } from './store';

interface CommonEnqueueOptions {
  dedupeKey?: string;
  maxAttempts?: number;
}

type EnqueueOptions = CommonEnqueueOptions &
  ({ delayMs?: number; runAt?: never } | { delayMs?: never; runAt?: Date });

interface JobClient {
  enqueue: <P>(
    definition: TypedJobFunction<P>,
    payload: P,
    options?: EnqueueOptions,
  ) => Promise<Job>;
}

const jsonText = z
  .string()
  .transform((text): unknown => JSON.parse(text))
  .pipe(z.json());

const createJobClient = (store: JobStore, clock: Clock = Date.now): JobClient => ({
  enqueue: async (definition, payload, options = {}) => {
    const { dedupeKey = null, delayMs = 0, maxAttempts = definition.maxAttempts, runAt } = options;
    assertPositiveInteger(definition.name, 'maxAttempts', maxAttempts);
    if (!Number.isFinite(delayMs) || delayMs < 0) {
      throw new Error(`Function "${definition.name}": delayMs must be a non-negative number`);
    }
    if (Number.isNaN(new Date(clock() + delayMs).getTime())) {
      throw new TypeError(`Function "${definition.name}": delayMs is too large`);
    }
    if (runAt !== undefined && Number.isNaN(runAt.getTime())) {
      throw new Error(`Function "${definition.name}": runAt must be a valid date`);
    }
    const now = new Date(clock());
    const stored = jsonText.parse(JSON.stringify(definition.schema.parse(payload)));
    const reparsed = definition.schema.safeParse(stored);
    if (!reparsed.success) {
      throw new Error(`Function "${definition.name}": payload does not survive JSON storage`, {
        cause: reparsed.error,
      });
    }
    return await store.enqueue({
      createdAt: now,
      dedupeKey,
      functionName: definition.name,
      id: generateUuid(),
      maxAttempts,
      payload: stored,
      runAt: runAt ?? new Date(now.getTime() + delayMs),
      updatedAt: now,
    });
  },
});

export { createJobClient, jsonText };
export type { CommonEnqueueOptions, EnqueueOptions, JobClient };
