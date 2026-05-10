import {
  apiEndpoint,
  docsUrl,
  trpcEndpoint,
  trpcPlaygroundUrl,
} from '@lightproject/common/configs';
import { getEnv, isLocal, isTest } from '@lightproject/common/environment';
import type { ExpressRequestHandler } from './types/middlware';
import { build } from './utils/autogen';
import cors from 'cors';
import { corsOptions } from './utils/cors';
// import { cspMiddleware } from './middlewares/csp';
import { errorHandler } from './middlewares/error-handler';
import express from 'express';
import { gatewayMiddleware } from './middlewares/gateway-middleware';
import { initializeRequest } from './middlewares/initialize-request';
import { logger } from '@lightproject/common/logger';
import { notFoundHandler } from './middlewares/not-found-handler';
import { padEmoji } from '@lightproject/common/utils';
import { registerHttpRoutes } from './utils/http-router';
import { registerTrpcRoutes } from './utils/trpc-router';
import { swaggerOpenApiMiddleware } from './middlewares/swagger-openapi';
import { trpcPlayground } from './middlewares/trpc-playground';
import { trustProxyMiddleware } from './middlewares/trust-proxy';

const createApp = async (shouldAutogen = false) => {
  if (shouldAutogen) {
    try {
      await build();
    } catch (error) {
      logger.error('Error in autogen script:', error as Record<string, unknown>);
      globalThis.process.exit(1);
    }
  }

  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors(corsOptions));

  app.use(initializeRequest as ExpressRequestHandler);
  app.use(gatewayMiddleware as ExpressRequestHandler);

  app.set('trust proxy', true);
  app.use(trustProxyMiddleware);

  //   app.use(cspMiddleware);

  registerHttpRoutes(app, apiEndpoint);
  registerTrpcRoutes(app, trpcEndpoint);

  if (isLocal()) {
    trpcPlayground(app).catch((error) => {
      logger.error('Failed to initialize tRPC Playground:', error);
    });
    logger.info(`🧪 tRPC Playground: ${trpcPlaygroundUrl}`);
    swaggerOpenApiMiddleware(app);
    logger.info(`📚 Swagger UI: ${docsUrl}`);
  }

  app.use(notFoundHandler);

  app.use(errorHandler as unknown as ExpressRequestHandler);

  return app;
};

const createTestApp = async () => {
  const modulePath = new globalThis.URL('../src/main', import.meta.url).pathname;

  await import(`${modulePath}?t=${Date.now()}`);

  return createApp();
};

const startServer = async () => {
  const app = isTest() ? await createTestApp() : await createApp(isLocal());

  const port = Number.parseInt(getEnv('API_PORT') ?? '3000', 10);

  const emojiPadding = 3;

  app.listen(port, () => {
    logger.info(`${padEmoji('🖥️', emojiPadding)} Server is running on http://localhost:${port}`);
  });
};

export { createApp, createTestApp, startServer };
