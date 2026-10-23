import { z } from 'zod';

import { defineFunction } from '../core/function';

const ping = defineFunction({
  concurrency: 2,
  handler: async ({ message }, { attempt, idempotencyKey, logger }) => {
    await Promise.resolve();
    logger.info(`ping: ${message}`, { attempt, idempotencyKey });
  },
  name: 'ping',
  schema: z.object({ message: z.string() }),
});

export { ping };
