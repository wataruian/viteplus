import { logger } from '@lightproject/common/logger';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { ping, scripts } from '../../../src/scripts';
import { useLocalDatabase } from '../helpers/database';
import { context, runDirectly } from '../helpers/scripts';

const { openDatabase } = useLocalDatabase();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('scripts', () => {
  test('registers ping on a schedule', () => {
    expect(scripts).toContain(ping);
    expect(ping.schedule).toBe('*/5 * * * *');
  });

  test('ping waits delayMs first, and stops waiting on abort', async () => {
    const info = vi.spyOn(logger, 'info');
    const database = await openDatabase();

    await runDirectly(ping, { delayMs: 20, message: 'late' }, context(database));
    expect(info).toHaveBeenNthCalledWith(1, 'ping: waiting 20ms');
    expect(info).toHaveBeenNthCalledWith(2, 'ping: late', expect.anything());

    const stop = new globalThis.AbortController();
    const waiting = runDirectly(
      ping,
      { delayMs: 60_000 },
      context(database, { signal: stop.signal }),
    );
    stop.abort();
    await expect(waiting).rejects.toThrow();
    expect(info).toHaveBeenCalledTimes(3);
  });

  test('ping does not wait at all once already aborted', async () => {
    const info = vi.spyOn(logger, 'info');

    await expect(
      runDirectly(
        ping,
        { delayMs: 60_000 },
        context(await openDatabase(), { signal: globalThis.AbortSignal.abort() }),
      ),
    ).rejects.toThrow();
    expect(info).toHaveBeenCalledWith('ping: waiting 60000ms');
    expect(info).not.toHaveBeenCalledWith('ping: pong', expect.anything());
  });

  test('ping logs its message, defaulting to pong', async () => {
    const info = vi.spyOn(logger, 'info');

    await runDirectly(ping, {}, context(await openDatabase(), { trigger: 'schedule' }));
    await runDirectly(ping, { message: 'hello' }, context(await openDatabase()));

    expect(info).toHaveBeenNthCalledWith(1, 'ping: pong', {
      scheduledTime: '1970-01-01T00:00:00.000Z',
      trigger: 'schedule',
    });
    expect(info).toHaveBeenNthCalledWith(
      2,
      'ping: hello',
      expect.objectContaining({ trigger: 'manual' }),
    );
  });
});
