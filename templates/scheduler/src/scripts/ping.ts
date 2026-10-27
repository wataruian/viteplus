import { z } from 'zod';

import { defineScript } from '../core/script';

const pause = async (ms: number, signal: AbortSignal) => {
  signal.throwIfAborted();
  await new Promise<void>((resolve) => {
    const detach = new globalThis.AbortController();
    const timer = globalThis.setTimeout(() => {
      detach.abort();
      resolve();
    }, ms);
    signal.addEventListener(
      'abort',
      () => {
        globalThis.clearTimeout(timer);
        resolve();
      },
      { once: true, signal: detach.signal },
    );
  });
  signal.throwIfAborted();
};

const ping = defineScript({
  input: z.object({
    delayMs: z.number().int().min(0).max(120_000).default(0),
    message: z.string().default('pong'),
  }),
  name: 'ping',
  run: async ({ delayMs, message }, { logger, scheduledTime, signal, trigger }) => {
    if (delayMs > 0) {
      logger.info(`ping: waiting ${delayMs}ms`);
      await pause(delayMs, signal);
    }
    logger.info(`ping: ${message}`, { scheduledTime: scheduledTime.toISOString(), trigger });
  },
  schedule: '*/5 * * * *',
  timeoutMs: 30_000,
});

export { pause, ping };
