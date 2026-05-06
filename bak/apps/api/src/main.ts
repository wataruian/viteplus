import { endpoints } from '@lightproject/common/configs';
import { isLocal, isTest } from '@lightproject/common/environment';
import { logger } from '@lightproject/common/logger';
import { text } from '@lightproject/common/utils';
import cors from 'cors';
import express from 'express';
// import { cspMiddleware } from './middlewares/csp';
import { errorHandler } from './middlewares/error-handler';
import { gatewayMiddleware } from './middlewares/gateway-middleware';
import { initializeRequest } from './middlewares/initialize-request';
import { notFoundHandler } from './middlewares/not-found-handler';
import { swaggerOpenApiMiddleware } from './middlewares/swagger-openapi';
import { trpcPlayground } from './middlewares/trpc-playground';
import { trustProxyMiddleware } from './middlewares/trust-proxy';
import type { ExpressRequestHandler } from './types/middlware';
// import { autogen } from './utils/autogen';
import { corsOptions } from './utils/cors';
import { registerHttpRoutes } from './utils/http-router';
import { registerTrpcRoutes } from './utils/trpc-router';

// const createApp = async (shouldAutogen = true) => {
const createApp = () => {
  // if (shouldAutogen) {
  //   await autogen();
  // }

  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors(corsOptions));

  app.use(initializeRequest as ExpressRequestHandler);
  app.use(gatewayMiddleware as ExpressRequestHandler);

  app.set('trust proxy', true);
  app.use(trustProxyMiddleware);

  // app.use(cspMiddleware);

  registerHttpRoutes(app, endpoints.apiEndpoint);
  registerTrpcRoutes(app, endpoints.trpcEndpoint);

  if (isLocal()) {
    trpcPlayground(app).catch(error => {
      logger.error('Failed to initialize tRPC Playground:', error);
    });
    logger.info(`🧪 tRPC Playground: ${endpoints.trpcPlaygroundUrl}`);
    swaggerOpenApiMiddleware(app);
    logger.info(`📚 Swagger UI: ${endpoints.docsUrl}`);
  }

  app.use(notFoundHandler);

  app.use(errorHandler as unknown as ExpressRequestHandler);

  return app;
};

const createTestApp = () => {
  // Clear module cache in ESM environment
  // const modulePath = new URL('../src/main', import.meta.url).pathname;
  // const meta = import.meta as unknown as {
  //   require?: { cache: Record<string, unknown> };
  // };

  // if (meta.require?.cache) {
  //   for (const key of Object.keys(meta.require.cache)) {
  //     if (key.includes(modulePath)) {
  //       delete meta.require.cache[key];
  //     }
  //   }
  // }

  // Clear module cache in CommonJS environment
  if (typeof require !== 'undefined' && require.cache) {
    for (const key of Object.keys(require.cache)) {
      if (key.includes('main')) {
        delete require.cache[key];
      }
    }
  }

  return createApp();
};

// const startServer = async () => {
const startServer = () => {
  // const app =
  //   !isLocal() && !isTest() ? await createApp() : await createTestApp();

  const app = isLocal() || isTest() ? createTestApp() : createApp();

  const defaultPort = 3000;
  const port = process.env['PORT'] || defaultPort;
  const emojiPadding = 3;

  app.listen(port, () => {
    logger.info(
      `${text.padEmoji('🖥️', emojiPadding)} Server is running on http://localhost:${port}`
    );
  });
};

export { createApp, createTestApp, startServer };
