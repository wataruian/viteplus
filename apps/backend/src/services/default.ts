import { z } from '@hono/zod-openapi';

import { attachSchema } from '../schema';

class DefaultService {
  public static readonly root = attachSchema(
    async () => {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 75);
      });
      return { status: 'OK' };
    },
    {
      request: z.object({}),
      response: z.object({ status: z.string() }).openapi('RootResponse'),
    },
  );
}

export { DefaultService };
