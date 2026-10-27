import { describe, expect, test } from 'vite-plus/test';
import { z } from 'zod';

import {
  defaultTimeoutMs,
  defineScript,
  findScript,
  maxTimeoutMs,
  noInput,
  registerScripts,
  schedulesOf,
  scriptsFor,
} from '../../../src/core/script';
import { useLocalDatabase } from '../helpers/database';
import { context, runDirectly } from '../helpers/scripts';

const { openDatabase } = useLocalDatabase();

const run = async () => {
  await Promise.resolve();
};

describe('defineScript', () => {
  test('defaults the timeout and has no schedule', () => {
    const script = defineScript({ input: noInput, name: 'one-off', run });

    expect(script).toMatchObject({
      name: 'one-off',
      schedule: undefined,
      timeoutMs: defaultTimeoutMs,
    });
  });

  test('parses the input before running', async () => {
    const seen: number[] = [];
    const script = defineScript({
      input: z.object({ count: z.number().int() }),
      name: 'count',
      run: async ({ count }) => {
        await Promise.resolve();
        seen.push(count);
      },
    });

    await runDirectly(script, { count: 3 }, context(await openDatabase()));

    expect(seen).toStrictEqual([3]);
  });

  test('rejects invalid input without running', () => {
    const script = defineScript({ input: z.object({ count: z.number() }), name: 'count', run });

    const prepared = script.prepare({ count: 'x' });

    expect(prepared).toStrictEqual({
      error: '✖ Invalid input: expected number, received string\n  → at count',
    });
  });

  test.each(['Ping', 'ping_all', '-ping', 'ping/../x', ''])('rejects the name "%s"', (name) => {
    expect(() => defineScript({ input: noInput, name, run })).toThrow(/kebab-case/u);
  });

  test.each([0, -1, 1.5, maxTimeoutMs + 1])('rejects timeoutMs %s', (timeoutMs) => {
    expect(() => defineScript({ input: noInput, name: 'x', run, timeoutMs })).toThrow(/timeoutMs/u);
  });

  test('rejects an invalid schedule with the reason', () => {
    expect(() => defineScript({ input: noInput, name: 'x', run, schedule: '* * * * 1' })).toThrow(
      /invalid schedule "\* \* \* \* 1": .*names only/u,
    );
  });

  test('a scheduled script must accept {} as input', () => {
    expect(() =>
      defineScript({ input: z.object({ id: z.string() }), name: 'x', run, schedule: '0 * * * *' }),
    ).toThrow(/must accept \{\}/u);
  });
});

describe('registry', () => {
  const hourly = defineScript({ input: noInput, name: 'hourly', run, schedule: '0 * * * *' });
  const alsoHourly = defineScript({
    input: noInput,
    name: 'also-hourly',
    run,
    schedule: '0 * * * *',
  });
  const daily = defineScript({ input: noInput, name: 'daily', run, schedule: '0 3 * * *' });
  const manual = defineScript({ input: noInput, name: 'manual', run });
  const scripts = registerScripts([hourly, alsoHourly, daily, manual]);

  test('rejects duplicate names', () => {
    expect(() => registerScripts([hourly, hourly])).toThrow(/more than once/u);
  });

  test('finds a script by name', () => {
    expect(findScript(scripts, 'daily')).toBe(daily);
    expect(findScript(scripts, 'missing')).toBeUndefined();
  });

  test('selects the scripts of a cron', () => {
    expect(scriptsFor(scripts, '0 * * * *')).toStrictEqual([hourly, alsoHourly]);
    expect(scriptsFor(scripts, '*/5 * * * *')).toStrictEqual([]);
  });

  test('lists each schedule once, sorted', () => {
    expect(schedulesOf(scripts)).toStrictEqual(['0 * * * *', '0 3 * * *']);
  });
});
