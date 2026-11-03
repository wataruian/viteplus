import { z } from 'zod';

import { defineScript } from '../core/script';

const hello = defineScript({
  input: z.object({ name: z.string().min(1).max(100) }),
  name: 'hello',
  run: async ({ name }, { logger, signal, trigger }) => {
    await Promise.resolve();
    signal.throwIfAborted();
    logger.info(`hello: ${name}`, { trigger });
  },
  timeoutMs: 10_000,
});

export { hello };
