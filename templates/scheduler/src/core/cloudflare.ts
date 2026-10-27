import type { Script } from './script';

const cronWallLimitMs = 15 * 60_000;

const cronMaxRunMs = cronWallLimitMs - 60_000;

const cronCapWarnings = (scripts: readonly Script[]) =>
  scripts
    .filter(({ schedule, timeoutMs }) => schedule !== undefined && timeoutMs > cronMaxRunMs)
    .map(
      ({ name, timeoutMs }) =>
        `Script ${name}: timeoutMs ${timeoutMs} exceeds Cloudflare's cron limit; its scheduled runs on the Worker stop after ${cronMaxRunMs}ms`,
    );

export { cronCapWarnings, cronMaxRunMs, cronWallLimitMs };
