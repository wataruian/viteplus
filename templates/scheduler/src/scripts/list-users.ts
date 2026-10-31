import { z } from 'zod';

import { defineScript } from '../core/script';

const listUsers = defineScript({
  input: z.object({ limit: z.number().int().min(1).max(1000).default(100) }),
  name: 'list-users',
  run: async ({ limit }, { db, logger, signal }) => {
    signal.throwIfAborted();
    const users = await db.users.list({ limit });
    logger.info('list-users', {
      count: users.length,
      users: users.map(({ email, id, name }) => ({ email, id, name })),
    });
  },
  schedule: '*/5 * * * *',
  timeoutMs: 60_000,
});

export { listUsers };
