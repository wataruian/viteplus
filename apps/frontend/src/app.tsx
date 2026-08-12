import type { TrpcRouter } from '@lightproject/backend';
import { trpcUrl } from '@lightproject/common/configs';
import { getEnv, isNodeEnvTest, isTest, isTrue, isVitest } from '@lightproject/common/environment';
import { logger } from '@lightproject/common/logger';
import { Preview } from '@lightproject/design-system/components';
import { useSession } from '@lightproject/design-system/context';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { useEffect } from 'react';
import superjson from 'superjson';

const App = () => {
  const { sessionId } = useSession();

  useEffect(() => {
    const run = async () => {
      const isEnableTestRoutes =
        isTrue(getEnv('VITE_ENABLE_TEST_ROUTES')) || isTest() || isVitest() || isNodeEnvTest();

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
