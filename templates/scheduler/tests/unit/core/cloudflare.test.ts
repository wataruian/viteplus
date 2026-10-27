import { describe, expect, test } from 'vite-plus/test';

import { cronCapWarnings, cronMaxRunMs, cronWallLimitMs } from '../../../src/core/cloudflare';
import { defineScript, noInput } from '../../../src/core/script';
import { scripts } from '../../../src/scripts';

const run = async () => {
  await Promise.resolve();
};

describe('Cloudflare cron cap', () => {
  test('stops a cron run a minute before the 15 min wall limit', () => {
    expect(cronWallLimitMs).toBe(900_000);
    expect(cronMaxRunMs).toBe(840_000);
  });

  test('warns only for scheduled scripts whose timeout the cap shortens', () => {
    const long = defineScript({
      input: noInput,
      name: 'long',
      run,
      schedule: '0 3 * * *',
      timeoutMs: 60 * 60_000,
    });
    const longOneOff = defineScript({
      input: noInput,
      name: 'long-one-off',
      run,
      timeoutMs: 60 * 60_000,
    });
    const atCap = defineScript({
      input: noInput,
      name: 'at-cap',
      run,
      schedule: '0 3 * * *',
      timeoutMs: cronMaxRunMs,
    });

    expect(cronCapWarnings([long, longOneOff, atCap])).toStrictEqual([
      "Script long: timeoutMs 3600000 exceeds Cloudflare's cron limit; its scheduled runs on the Worker stop after 840000ms",
    ]);
  });

  test('has nothing to warn about in the registered scripts', () => {
    expect(cronCapWarnings(scripts)).toStrictEqual([]);
  });
});
