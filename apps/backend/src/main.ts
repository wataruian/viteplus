import {
  apiEndpoint,
  docsUrl,
  trpcEndpoint,
  trpcPlaygroundUrl,
} from '@lightproject/common/configs';
import { errorHandler, gatewayMiddleware } from './middlewares/gateway-middleware';
import { getEnv, isLocal, isTest } from '@lightproject/common/environment';
import { initializeRequest, isRequest, isResponse } from './middlewares/initialize-request';
import { build } from './utils/autogen';
import cors from 'cors';
import { corsOptions } from './utils/cors';
import express from 'express';
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
      logger.error(
        'Error in autogen script:',
        error instanceof Error ? { message: error.message, stack: error.stack } : { error },
      );
      globalThis.process.exit(1);
    }
  }

  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors(corsOptions));

  app.use(initializeRequest);
  app.use((req, res, next) => {
    if (!isRequest(req) || !isResponse(res)) {
      throw new Error('Invalid request or response context: missing locals');
    }
    gatewayMiddleware(req, res, next);
  });

  app.set('trust proxy', true);
  app.use((req, res, next) => {
    if (!isRequest(req) || !isResponse(res)) {
      throw new Error('Invalid request or response context: missing locals');
    }
    trustProxyMiddleware(req, res, next);
  });

  //   app.use(cspMiddleware);

  app.get(['', '/'], (_req, res) => {
    res.json({ message: 'OK' });
  });

  registerHttpRoutes(app, apiEndpoint);
  registerTrpcRoutes(app, trpcEndpoint);

  if (isLocal()) {
    trpcPlayground(app).catch((error: unknown) => {
      logger.error(
        'Failed to initialize tRPC Playground:',
        error instanceof Error ? { message: error.message, stack: error.stack } : { error },
      );
    });
    logger.info(`🧪 tRPC Playground: ${trpcPlaygroundUrl}`);
    swaggerOpenApiMiddleware(app);
    logger.info(`📚 Swagger UI: ${docsUrl}`);
  }

  app.use((req, res, next) => {
    if (!isRequest(req) || !isResponse(res)) {
      throw new Error('Invalid request or response context: missing locals');
    }
    notFoundHandler(req, res, next);
  });

  app.use(
    (err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (err instanceof Error) {
        if (!isRequest(req) || !isResponse(res)) {
          throw new Error('Invalid request or response context: missing locals');
        }
        errorHandler(err, req, res, next);
      } else {
        next(err);
      }
    },
  );

  return app;
};

const createTestApp = async () => {
  const modulePath = new globalThis.URL('../src/main', import.meta.url).pathname;

  await import(`${modulePath}?t=${Date.now()}`);

  return createApp();
};

const startServer = async () => {
  const app = isTest() ? await createTestApp() : await createApp(isLocal());

  const port = Math.trunc(Number(getEnv('API_PORT') ?? '3000'));

  const emojiPadding = 3;

  app.listen(port, () => {
    logger.info(`${padEmoji('🖥️', emojiPadding)} Server is running on http://localhost:${port}`);
  });
};

export { createApp, createTestApp, startServer };
