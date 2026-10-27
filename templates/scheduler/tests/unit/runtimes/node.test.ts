import { logger } from '@lightproject/common/logger';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { z } from 'zod';

import { type ScriptContext, defineScript, noInput } from '../../../src/core/script';
import { execute, exitCodes, parseCommand } from '../../../src/runtimes/node';
import { serviceName } from '../../../src/runtimes/telemetry';
import { useLocalDatabase } from '../helpers/database';

const { openDatabase } = useLocalDatabase();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseCommand', () => {
  test('runs a script with empty input by default', () => {
    expect(parseCommand(['ping'])).toStrictEqual({
      input: {},
      kind: 'run',
      name: 'ping',
      scheduled: false,
    });
  });

  test('parses --input as JSON', () => {
    expect(parseCommand(['ping', '--input', '{"message":"hi","n":[1,null]}'])).toStrictEqual({
      input: { message: 'hi', n: [1, null] },
      kind: 'run',
      name: 'ping',
      scheduled: false,
    });
  });

  test('marks scheduled runs', () => {
    expect(parseCommand(['ping', '--scheduled'])).toMatchObject({ kind: 'run', scheduled: true });
  });

  test('lists', () => {
    expect(parseCommand(['--list'])).toStrictEqual({ kind: 'list' });
  });

  test.each([
    [[]],
    [['a', 'b']],
    [['ping', '--input', '{nope']],
    [['ping', '--scheduled', '--input', '{}']],
    [['--list', 'ping']],
    [['--list', '--scheduled']],
    [['ping', '--unknown']],
    [['ping', '--input']],
  ])('rejects %j', (argv) => {
    expect(parseCommand(argv)).toMatchObject({ kind: 'usage' });
  });
});

describe('execute', () => {
  const runs: ScriptContext[] = [];
  const hourly = defineScript({
    input: z.object({ fail: z.boolean().default(false) }),
    name: 'hourly',
    run: async ({ fail }, context) => {
      await Promise.resolve();
      runs.push(context);
      if (fail) {
        throw new Error('asked to fail');
      }
    },
    schedule: '0 * * * *',
  });
  const manual = defineScript({ input: noInput, name: 'manual', run: async () => {} });
  const options = { openDatabase, scripts: [hourly, manual] };

  afterEach(() => {
    runs.length = 0;
  });

  test('lists every script with its schedule', async () => {
    const written: string[] = [];
    const write = (text: string) => {
      written.push(text);
    };

    expect(await execute({ kind: 'list' }, { ...options, write })).toBe(exitCodes.succeeded);
    expect(written).toStrictEqual(['hourly\t0 * * * *\nmanual\tmanual only\n']);
  });

  test('runs a script manually', async () => {
    expect(await execute(parseCommand(['hourly']), options)).toBe(exitCodes.succeeded);
    expect(runs[0]?.trigger).toBe('manual');
  });

  test('runs a script as scheduled', async () => {
    expect(await execute(parseCommand(['hourly', '--scheduled']), options)).toBe(
      exitCodes.succeeded,
    );
    expect(runs[0]?.trigger).toBe('schedule');
  });

  test('exits 1 when the script fails', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    expect(await execute(parseCommand(['hourly', '--input', '{"fail":true}']), options)).toBe(
      exitCodes.failed,
    );
  });

  test('exits 1 when stopped', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const stop = new globalThis.AbortController();
    stop.abort();

    expect(await execute(parseCommand(['hourly']), { ...options, signal: stop.signal })).toBe(
      exitCodes.failed,
    );
  });

  test('exits 3 while a previous run still holds the lock', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const database = await openDatabase();
    const lock = { leaseMs: 60_000, name: `${serviceName}/hourly`, owner: 'elsewhere' };
    await database.scriptLocks.acquire(lock);

    expect(await execute(parseCommand(['hourly']), options)).toBe(exitCodes.busy);
    expect(runs).toStrictEqual([]);
    await database.scriptLocks.release(lock);
  });

  test.each([
    ['usage', { error: 'bad', kind: 'usage' } as const],
    ['an unknown script', parseCommand(['missing'])],
    ['invalid input', parseCommand(['hourly', '--input', '{"fail":"yes"}'])],
    ['a scheduled run of a manual script', parseCommand(['manual', '--scheduled'])],
  ])('exits 2 on %s', async (_case, command) => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});

    expect(await execute(command, options)).toBe(exitCodes.usage);
    expect(error).toHaveBeenCalled();
  });
});
