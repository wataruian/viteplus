import type { TrpcRouter } from '@lightproject/backend';
import { apiBaseUrl, trpcUrl } from '@lightproject/common/configs';
import { isNodeEnvTest, isTest, isVitest } from '@lightproject/common/environment';
import { logger } from '@lightproject/common/logger';
import { Preview } from '@lightproject/design-system/components';
import { useSession } from '@lightproject/design-system/context';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { useEffect } from 'react';
import superjson from 'superjson';

import { config } from './config';

const App = () => {
  const { sessionId } = useSession();

  useEffect(() => {
    const run = async () => {
      const isEnableTestRoutes =
        config.viteEnableTestRoutes || isTest() || isVitest() || isNodeEnvTest();

      if (isEnableTestRoutes) {
        try {
          const trpcClient = createTRPCClient<TrpcRouter>({
            links: [
              httpBatchLink({
                transformer: superjson,
                url: trpcUrl,
              }),
            ],
          });

          const result = await trpcClient.test.hello.mutate({
            firstName: 'Test',
          });

          logger.info('tRPC Sample Result', {
            result,
          });
        } catch (error: unknown) {
          logger.error('Failed to call tRPC server', {
            error,
          });
        }
      }

      let viteApiUrl = apiBaseUrl;
      if (config.viteApiUrl === undefined) {
        logger.info(`VITE_API_URL is not set, using default URL: ${viteApiUrl}`);
      } else {
        ({ viteApiUrl } = config);
        logger.info(`VITE_API_URL is set: ${viteApiUrl}`);
      }

      logger.info('Frontend Start', {
        clientId: sessionId,
        platform: globalThis.navigator.userAgent,
        timestamp: new Date().toISOString(),
      });
    };

    run().catch((error: unknown) => {
      logger.error('Failed to initialize frontend', { error });
    });
  }, [logger, sessionId]);

  return (
    <>
      <Preview showDefault={true} />
    </>
  );
};

export default App;
