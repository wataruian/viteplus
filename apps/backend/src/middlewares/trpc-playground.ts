import { trpcEndpoint, trpcPlaygroundEndpoint } from '@lightproject/common/configs';
import type { Express } from 'express';
import { expressHandler } from 'trpc-playground/handlers/express';

import { getTrpcRouter } from '../routers/trpc';

const trpcPlayground = async (app: Express): Promise<void> => {
  app.use(
    trpcPlaygroundEndpoint,
    await expressHandler({
      playgroundEndpoint: trpcPlaygroundEndpoint,
      request: {
        superjson: true,
      },
      router: getTrpcRouter(),
      trpcApiEndpoint: trpcEndpoint,
    }),
  );
};

export { trpcPlayground };
