import { z } from 'zod';

import { defineFunction } from '../core/function';

const listUsers = defineFunction({
  handler: async ({ limit }, { getDatabase, idempotencyKey, logger, signal, withTrace }) => {
    signal.throwIfAborted();
    const database = await getDatabase();
    const users = await withTrace(async () => await database.users.list({ limit }));
    logger.info('list-users', {
      count: users.length,
      idempotencyKey,
      users: users.map(({ email, id, name }) => ({ email, id, name })),
    });
  },
  name: 'list-users',
  schema: z.object({ limit: z.number().int().min(1).max(1000).default(100) }),
  timeoutMs: 60_000,
});

export { listUsers };
