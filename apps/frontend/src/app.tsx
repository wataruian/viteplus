import type { TrpcRouter } from '@lightproject/backend';
import { apiBaseUrl, trpcUrl } from '@lightproject/common/configs';
import { isNodeEnvTest, isTest, isVitest } from '@lightproject/common/environment';
import { logger } from '@lightproject/common/logger';
import { type Counter, getMeter, tracer } from '@lightproject/common/utils';
import { Button, Container, Preview } from '@lightproject/design-system/components';
import { useSession } from '@lightproject/design-system/context';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { useEffect } from 'react';
import superjson from 'superjson';

import { config } from './config';

let buttonClicksCounter: Counter | undefined = undefined;

const handleTestClick = () => {
  try {
    buttonClicksCounter ??= getMeter().createCounter('button_clicks', {
      description: 'frontend button clicks',
    });
    buttonClicksCounter.add(1);
    logger.info('Pushed button_clicks metric');
  } catch {
    // Skip metric counter if it fails
  }
};

const App = () => {
  const { sessionId } = useSession();

  useEffect(() => {
    const run = async () => {
      const span = tracer.startSpan('app.initialize', {
        attributes: {
          'client.id': sessionId,
        },
        root: true,
      });

      try {
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

            span.addEvent('Executing tRPC test mutation');

            const result = await trpcClient.test.hello.mutate({
              firstName: 'Test',
            });

            span.setAttribute('trpc.test.success', true);

            logger.info('tRPC Sample Result', {
              result,
            });
          } catch (error: unknown) {
            span.recordException(error instanceof Error ? error : String(error));
            span.setAttribute('trpc.test.success', false);

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

        span.setAttribute('app.initialized', true);
      } catch (error: unknown) {
        span.recordException(error instanceof Error ? error : String(error));
        span.setAttribute('app.initialized', false);

        logger.error('Failed to initialize frontend', { error });
      } finally {
        span.end();
      }
    };

    run().catch(() => {
      // Errors already logged and recorded in span
    });
  }, [sessionId]);

  return (
    <>
      <Container>
        <div className='flex justify-end pt-layout-md'>
          <Button props={{ onClick: handleTestClick }}>Test Counter Metric</Button>
        </div>
      </Container>
      <Preview showDefault={true} />
    </>
  );
};

export default App;
