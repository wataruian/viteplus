import { logger } from '@lightproject/common/logger';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { schedulesOf, scriptsFor } from '../../../src/core/script';
import { hello, scripts } from '../../../src/scripts';
import { useLocalDatabase } from '../helpers/database';
import { context, runDirectly } from '../helpers/scripts';

const { openDatabase } = useLocalDatabase();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('hello', () => {
  test('is registered as a one-off script with no schedule', () => {
    expect(scripts).toContain(hello);
    expect(hello.schedule).toBeUndefined();
    expect(scriptsFor(scripts, '*/5 * * * *')).not.toContain(hello);
    expect(schedulesOf(scripts)).toStrictEqual(['*/5 * * * *']);
  });

  test('logs a greeting for the given name', async () => {
    const info = vi.spyOn(logger, 'info');

    await runDirectly(hello, { name: 'Ada' }, context(await openDatabase()));

    expect(info).toHaveBeenCalledWith('hello: Ada', { trigger: 'manual' });
  });

  test('requires a name, which only an unscheduled script may do', () => {
    expect(hello.prepare({})).toHaveProperty('error');
    expect(hello.prepare({ name: '' })).toHaveProperty('error');
  });

  test('stops before logging once aborted', async () => {
    const info = vi.spyOn(logger, 'info');
    const stop = new globalThis.AbortController();
    stop.abort();

    await expect(
      runDirectly(hello, { name: 'Ada' }, context(await openDatabase(), { signal: stop.signal })),
    ).rejects.toThrow();
    expect(info).not.toHaveBeenCalled();
  });
});
