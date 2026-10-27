import type { LevelLogger } from '@lightproject/common/logger';
import type { repositories, shared } from '@lightproject/datastore';
import { z } from 'zod';

import { checkSchedule } from './schedule';

type ScriptLogger = LevelLogger;

type Trigger = 'manual' | 'schedule';

type JsonValue = shared.JsonValue;

interface ScriptContext {
  db: repositories.Database;
  logger: ScriptLogger;
  scheduledTime: Date;
  signal: AbortSignal;
  trigger: Trigger;
  withTrace: <R>(fn: () => R) => R;
}

interface ScriptOptions<I> {
  name: string;
  input: z.ZodType<I>;
  run: (input: I, context: ScriptContext) => Promise<void>;
  schedule?: string;
  timeoutMs?: number;
}

type PreparedRun = (context: ScriptContext) => Promise<void>;

type Prepared = { run: PreparedRun } | { error: string };

interface Script {
  readonly name: string;
  readonly input: z.ZodType;
  readonly schedule: string | undefined;
  readonly timeoutMs: number;
  readonly prepare: (input: JsonValue) => Prepared;
}

class InvalidInputError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InvalidInputError';
  }
}

const noInput = z.object({}).strict();

const defaultTimeoutMs = 10 * 60_000;

const maxTimeoutMs = 24 * 60 * 60_000;

const namePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

const defineScript = <I>({
  input,
  name,
  run,
  schedule,
  timeoutMs = defaultTimeoutMs,
}: ScriptOptions<I>): Script => {
  if (!namePattern.test(name)) {
    throw new Error(
      `Script name "${name}" must be kebab-case (it is a CLI argument and a URL path)`,
    );
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > maxTimeoutMs) {
    throw new Error(`Script "${name}": timeoutMs must be an integer in 1..${maxTimeoutMs}`);
  }
  if (schedule !== undefined) {
    const reason = checkSchedule(schedule);
    if (reason !== undefined) {
      throw new Error(`Script "${name}": invalid schedule "${schedule}": ${reason}`);
    }
    if (!input.safeParse({}).success) {
      throw new Error(`Script "${name}" is scheduled, so its input schema must accept {}`);
    }
  }
  const prepare = (raw: JsonValue): Prepared => {
    const parsed = input.safeParse(raw);
    return parsed.success
      ? {
          run: async (context) => {
            await run(parsed.data, context);
          },
        }
      : { error: z.prettifyError(parsed.error) };
  };
  return {
    input,
    name,
    prepare,
    schedule,
    timeoutMs,
  };
};

const registerScripts = (scripts: readonly Script[]): readonly Script[] => {
  const seen = new Set<string>();
  for (const { name } of scripts) {
    if (seen.has(name)) {
      throw new Error(`Script "${name}" is registered more than once`);
    }
    seen.add(name);
  }
  return scripts;
};

const findScript = (scripts: readonly Script[], name: string) =>
  scripts.find((script) => script.name === name);

const scriptsFor = (scripts: readonly Script[], cron: string) =>
  scripts.filter(({ schedule }) => schedule === cron);

const schedulesOf = (scripts: readonly Script[]) =>
  [
    ...new Set(scripts.flatMap(({ schedule }) => (schedule === undefined ? [] : [schedule]))),
  ].toSorted();

export {
  defaultTimeoutMs,
  defineScript,
  findScript,
  InvalidInputError,
  maxTimeoutMs,
  namePattern,
  noInput,
  registerScripts,
  schedulesOf,
  scriptsFor,
};
export type {
  JsonValue,
  Prepared,
  PreparedRun,
  Script,
  ScriptContext,
  ScriptLogger,
  ScriptOptions,
  Trigger,
};
