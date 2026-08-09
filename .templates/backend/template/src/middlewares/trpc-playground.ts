import { trpcEndpoint, trpcPlaygroundEndpoint } from '@lightproject/common/configs';
import type { Express } from 'express';
import { expressHandler } from 'trpc-playground/handlers/express';
import { trpcRouter } from '../routers/trpc';

const trpcPlayground = async (app: Express) => {
  app.use(
    trpcPlaygroundEndpoint,
    await expressHandler({
      playgroundEndpoint: trpcPlaygroundEndpoint,
      request: {
        superjson: true,
      },
      router: trpcRouter,
      trpcApiEndpoint: trpcEndpoint,
    }),
  );
};

export { trpcPlayground };
