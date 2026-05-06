import { endpoints } from '@lightproject/common/configs';
import type { Express } from 'express';
import { expressHandler } from 'trpc-playground/handlers/express';

import { trpcRouter } from '../routers/trpc';

export const trpcPlayground = async (app: Express) => {
  app.use(
    endpoints.trpcPlaygroundEndpoint,
    await expressHandler({
      playgroundEndpoint: endpoints.trpcPlaygroundEndpoint,
      request: {
        superjson: true,
      },
      router: trpcRouter,
      trpcApiEndpoint: endpoints.trpcEndpoint,
    })
  );
};
