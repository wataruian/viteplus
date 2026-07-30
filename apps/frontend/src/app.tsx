import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { Preview } from '@lightproject/design-system/components';
import type { TrpcRouter } from '@lightproject/backend';
import { logger } from '@lightproject/common/logger';
import superjson from 'superjson';
import { trpcUrl } from '@lightproject/common/configs';
import { useEffect } from 'react';

const App = () => {
  useEffect(() => {
    const run = async () => {
      const isEnableTestRoutes =
        import.meta.env['VITE_ENABLE_TEST_ROUTES'] === 'true' ||
        import.meta.env['VITE_ENV'] === 'test' ||
        import.meta.env['VITEST'] === 'true' ||
        import.meta.env['NODE_ENV'] === 'test';

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

      logger.info('Frontend Start', {
        platform: globalThis.navigator.userAgent,
        timestamp: new Date().toISOString(),
      });
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
