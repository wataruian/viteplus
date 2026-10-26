import { z } from 'zod';

import { createJobClient } from '../../../src/core/client';
import { type FunctionOptions, defineFunction } from '../../../src/core/function';
import { type RunnerOptions, createInProcessExecutor } from '../../../src/core/runner';
import type { Clock } from '../../../src/core/store';
import { createMemoryStore } from '../../../src/stores/memory';
import { createClock } from './job-store-contract';

interface TestPayload {
  value: number;
}

const testFunction = (overrides: Partial<FunctionOptions<TestPayload>> = {}) =>
  defineFunction<TestPayload>({
    backoff: () => 1000,
    handler: async () => {
      await Promise.resolve();
    },
    name: 'test',
    schema: z.object({ value: z.number() }),
    ...overrides,
  });

const setup = (overrides: Partial<FunctionOptions<TestPayload>> = {}) => {
  const time = createClock();
  const store = createMemoryStore();
  const definition = testFunction(overrides);
  const client = createJobClient(store, time.clock);
  const runner: RunnerOptions = {
    clock: time.clock,
    definition,
    execute: createInProcessExecutor([definition]),
    leaseMs: 30_000,
    store,
    storeClock: time.clock,
    workerId: 'worker-1',
  };
  return { client, definition, runner, store, time };
};

const claimFor = (clock: Clock, functionName: string, leaseOwner: string, leaseMs: number) => {
  const now = clock();
  return { functionName, leaseMs, leaseOwner, now: new Date(now) };
};

export { claimFor, setup, testFunction };
export type { TestPayload };
