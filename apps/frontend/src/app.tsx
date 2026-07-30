import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { getEnv, isTest } from '@lightproject/common/environment';
import { Preview } from '@lightproject/design-system/components';
import type { TrpcRouter } from '@lightproject/backend';
import { logger } from '@lightproject/common/logger';
import superjson from 'superjson';
import { trpcUrl } from '@lightproject/common/configs';
import { useEffect } from 'react';

const App = () => {
  useEffect(() => {
    const run = async () => {
      logger.info('Frontend Start', {
        platform: globalThis.navigator.userAgent,
        timestamp: new Date().toISOString(),
      });

      globalThis.console.log('ENABLE_TEST_ROUTES', getEnv('ENABLE_TEST_ROUTES'));
      globalThis.console.log('isTest', isTest());
      globalThis.console.log('VITEST', getEnv('VITEST'));
      globalThis.console.log('NODE_ENV', getEnv('NODE_ENV'));

      const isEnableTestRoutes =
        getEnv('ENABLE_TEST_ROUTES') === 'true' ||
        isTest() ||
        getEnv('VITEST') === 'true' ||
        getEnv('NODE_ENV') === 'test';

      if (isEnableTestRoutes) {
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
      }
    };

    run().catch((error: unknown) => {
      logger.error('Failed to initialize frontend', { error });
    });
  }, [logger]);

  return (
    <>
      <Preview showDefault={true} />
    </>
  );
};

export default App;
