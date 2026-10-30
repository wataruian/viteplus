import type { LevelLogger } from '@lightproject/common/logger';
import type { z } from 'zod';

import type { Job, JsonValue } from './job';
import { maxTimerMs } from './timing';

type JobLogger = LevelLogger;

interface JobContext {
  attempt: number;
  idempotencyKey: string;
  job: Job;
  logger: JobLogger;
  signal: AbortSignal;
  skip: (reason: string) => void;
  withTrace: <R>(fn: () => R) => R;
}

type Backoff = (attempt: number) => number;

interface FunctionOptions<P> {
  name: string;
  schema: z.ZodType<P>;
  handler: (payload: P, context: JobContext) => Promise<void>;
  concurrency?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  backoff?: Backoff;
}

interface JobFunction {
  readonly name: string;
  readonly schema: z.ZodType;
  readonly concurrency: number;
  readonly maxAttempts: number;
  readonly timeoutMs: number;
  readonly backoff: Backoff;
  readonly execute: (payload: JsonValue, context: JobContext) => Promise<void>;
}

interface TypedJobFunction<P> extends JobFunction {
  readonly schema: z.ZodType<P>;
}

class UnrecoverableJobError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'UnrecoverableJobError';
  }
}

const defaultMaxAttempts = 5;
const defaultTimeoutMs = 60_000;

const randomFraction = () => {
  const [value] = globalThis.crypto.getRandomValues(new Uint32Array(1));
  return value / 2 ** 32;
};

const exponentialBackoff =
  ({ baseMs = 1000, maxMs = 300_000 }: { baseMs?: number; maxMs?: number } = {}): Backoff =>
  (attempt) => {
    const delay = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
    return Math.round(delay / 2 + randomFraction() * (delay / 2));
  };

const assertPositiveInteger = (name: string, key: string, value: number) => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Function "${name}": ${key} must be a positive integer, got ${value}`);
  }
};

const defineFunction = <P>(options: FunctionOptions<P>): TypedJobFunction<P> => {
  const {
    backoff = exponentialBackoff(),
    concurrency = 1,
    handler,
    maxAttempts = defaultMaxAttempts,
    name,
    schema,
    timeoutMs = defaultTimeoutMs,
  } = options;

  assertPositiveInteger(name, 'concurrency', concurrency);
  assertPositiveInteger(name, 'maxAttempts', maxAttempts);
  assertPositiveInteger(name, 'timeoutMs', timeoutMs);
  if (timeoutMs > maxTimerMs) {
    throw new Error(
      `Function "${name}": timeoutMs must be at most ${maxTimerMs}, got ${timeoutMs}`,
    );
  }

  return {
    backoff,
    concurrency,
    execute: async (payload, context) => {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        throw new UnrecoverableJobError(`Invalid payload: ${parsed.error.message}`, {
          cause: parsed.error,
        });
      }
      await handler(parsed.data, context);
    },
    maxAttempts,
    name,
    schema,
    timeoutMs,
  };
};

const assertUniqueNames = (functions: readonly JobFunction[]) => {
  const seen = new Set<string>();
  for (const { name } of functions) {
    if (seen.has(name)) {
      throw new Error(`Duplicate job function name: "${name}"`);
    }
    seen.add(name);
  }
};

export {
  assertPositiveInteger,
  assertUniqueNames,
  defaultMaxAttempts,
  defaultTimeoutMs,
  defineFunction,
  exponentialBackoff,
  randomFraction,
  UnrecoverableJobError,
};
export type { Backoff, FunctionOptions, JobContext, JobFunction, JobLogger, TypedJobFunction };
