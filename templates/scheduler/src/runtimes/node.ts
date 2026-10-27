import { parseArgs } from 'node:util';

import { logger } from '@lightproject/common/logger';
import { shutdownTelemetry } from '@lightproject/common/server';
import { settleWithin } from '@lightproject/common/utils';
import { db, type repositories } from '@lightproject/datastore';
import { z } from 'zod';

import { type RunOptions, type RunOutcome, runScript } from '../core/runner';
import { type JsonValue, type Script, findScript } from '../core/script';
import { scripts as registered } from '../scripts';
import { serviceName, startTelemetry } from './telemetry';

type Command =
  | { kind: 'list' }
  | { kind: 'run'; input: JsonValue; name: string; scheduled: boolean }
  | { kind: 'usage'; error: string };

interface ExecuteOptions {
  openDatabase: () => Promise<repositories.Database>;
  scripts: readonly Script[];
  signal?: AbortSignal;
  write?: (text: string) => void;
}

const exitCodes = { busy: 3, failed: 1, lockLost: 4, succeeded: 0, usage: 2 } as const;

const telemetryFlushMs = 3000;

const usage = 'usage: <script> [--input <json>] | <script> --scheduled | --list';

const parseArguments = (argv: readonly string[]) => {
  try {
    return parseArgs({
      allowPositionals: true,
      args: [...argv],
      options: {
        input: { type: 'string' },
        list: { type: 'boolean' },
        scheduled: { type: 'boolean' },
      },
    });
  } catch (error) {
    return error instanceof Error ? error : new Error('invalid arguments');
  }
};

const parseCommand = (argv: readonly string[]): Command => {
  const parsed = parseArguments(argv);
  if (parsed instanceof Error) {
    return { error: `${parsed.message}; ${usage}`, kind: 'usage' };
  }
  const { positionals, values } = parsed;
  if (values.list === true) {
    return positionals.length === 0 && values.input === undefined && values.scheduled !== true
      ? { kind: 'list' }
      : { error: `--list takes no other arguments; ${usage}`, kind: 'usage' };
  }
  if (positionals.length !== 1) {
    return { error: usage, kind: 'usage' };
  }
  const [name] = positionals;
  const scheduled = values.scheduled === true;
  if (values.input === undefined) {
    return { input: {}, kind: 'run', name, scheduled };
  }
  if (scheduled) {
    return { error: `--scheduled runs take no --input; ${usage}`, kind: 'usage' };
  }
  try {
    return { input: z.json().parse(JSON.parse(values.input)), kind: 'run', name, scheduled };
  } catch {
    return { error: '--input must be valid JSON', kind: 'usage' };
  }
};

const execute = async (
  command: Command,
  {
    openDatabase,
    scripts,
    signal,
    write = (text) => globalThis.process.stdout.write(text),
  }: ExecuteOptions,
): Promise<number> => {
  if (command.kind === 'usage') {
    logger.error(command.error);
    return exitCodes.usage;
  }
  if (command.kind === 'list') {
    write(scripts.map(({ name, schedule }) => `${name}\t${schedule ?? 'manual only'}\n`).join(''));
    return exitCodes.succeeded;
  }
  const script = findScript(scripts, command.name);
  if (script === undefined) {
    logger.error(`Unknown script "${command.name}" (--list shows the registered ones)`);
    return exitCodes.usage;
  }
  if (command.scheduled && script.schedule === undefined) {
    logger.error(`Script "${script.name}" has no schedule; run it without --scheduled`);
    return exitCodes.usage;
  }
  const options: RunOptions = {
    input: command.input,
    lockScope: serviceName,
    openDatabase,
    trigger: command.scheduled ? 'schedule' : 'manual',
    ...(signal === undefined ? {} : { signal }),
  };
  const { outcome } = await runScript(script, options);
  const codes: Record<RunOutcome, number> = {
    aborted: exitCodes.failed,
    failed: exitCodes.failed,
    'invalid-input': exitCodes.usage,
    'lock-lost': exitCodes.lockLost,
    skipped: exitCodes.busy,
    succeeded: exitCodes.succeeded,
    'timed-out': exitCodes.failed,
  };
  return codes[outcome];
};

const registerStop = (controller: AbortController) => {
  const onSignal = (signal: NodeJS.Signals) => {
    if (controller.signal.aborted) {
      logger.warn(`Received ${signal} again, exiting without waiting for the script`);
      globalThis.process.exit(exitCodes.failed);
    }
    logger.info(`Received ${signal}; aborting the script`);
    controller.abort();
  };
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) {
    globalThis.process.on(signal, onSignal);
  }
};

const main = async (argv: readonly string[]) => {
  const command = parseCommand(argv);
  if (command.kind !== 'run') {
    return await execute(command, { openDatabase: db.createDatabase, scripts: registered });
  }
  const controller = new globalThis.AbortController();
  registerStop(controller);
  await startTelemetry();
  const code = await execute(command, {
    openDatabase: db.createDatabase,
    scripts: registered,
    signal: controller.signal,
  });
  if (!(await settleWithin(shutdownTelemetry(), telemetryFlushMs))) {
    logger.warn(`Telemetry did not flush within ${telemetryFlushMs}ms; exiting without it`);
  }
  return code;
};

const bootstrap = () => {
  main(globalThis.process.argv.slice(2)).then(
    (code) => {
      globalThis.process.exit(code);
    },
    (error: unknown) => {
      logger.error('Script runner failed', { error });
      globalThis.process.exit(exitCodes.failed);
    },
  );
};

export {
  bootstrap,
  execute,
  exitCodes,
  main,
  parseArguments,
  parseCommand,
  registerStop,
  telemetryFlushMs,
  usage,
};
export type { Command, ExecuteOptions };
