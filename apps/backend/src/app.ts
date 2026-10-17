import { logger, requestContextStorage } from '@lightproject/common/logger';
import {
  flushTelemetry,
  initializeContextPropagation,
  initializeTelemetry,
  prometheusExporter,
} from '@lightproject/common/server';
import { generateShortUuid } from '@lightproject/common/utils';
import { Hono } from 'hono';
import { trimTrailingSlash } from 'hono/trailing-slash';

import packageJson from '../package.json' with { type: 'json' };
import { config } from './config';
import { env } from './env';
import { globalErrorHandler, notFoundHandler } from './middlewares/error-handler';
import { requestLogger } from './middlewares/logger';
import { corsMiddleware, cspMiddleware } from './middlewares/security';
import { trustProxy } from './middlewares/trust-proxy';
import { getRequestStore, parseIncomingId } from './request-context';
import { docsRouter } from './routers/docs';
import { httpRouter } from './routers/http';
import { trpcOpenApiRouter, trpcRouter } from './routers/trpc';
import type { AppEnv } from './schema';

const getApp = async () => {
  const port = env.BACKEND_PORT;
  if (port === undefined) {
    logger.info(`BACKEND_PORT is not set, using default port: ${config.backendPort}`);
  } else {
    logger.info(`BACKEND_PORT is set: ${port}`);
  }

  if (config.skipOpenTelemetry) {
    initializeContextPropagation();
  } else {
    await initializeTelemetry({
      serviceName: packageJson.name,
      serviceVersion: packageJson.version,
    });
  }

  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    const requestId = parseIncomingId(c.req.header('X-Request-Id')) ?? generateShortUuid();
    c.set('requestId', requestId);
    c.set('clientId', parseIncomingId(c.req.header('X-Client-Id')));
    await requestContextStorage.run(getRequestStore(c), async () => {
      await next();
    });
    c.res.headers.set('X-Request-Id', requestId);
  });

  app.use('*', async (c, next) => {
    await next();
    let executionCtx: { waitUntil?: (p: Promise<unknown>) => void } | undefined = undefined;
    try {
      ({ executionCtx } = c);
    } catch {
      // Ignore if executionCtx is not available
    }

    if (typeof executionCtx?.waitUntil === 'function') {
      executionCtx.waitUntil(flushTelemetry());
    }
  });

  app.use('*', requestLogger());
  app.use('*', trimTrailingSlash());
  app.use('*', corsMiddleware());
  app.use('*', cspMiddleware());
  app.use('*', trustProxy());

  app.notFound(notFoundHandler);
  app.onError(globalErrorHandler);

  app.get('/', (c) => c.json({ status: 'OK' }));

  app.get('/metrics', async () => await prometheusExporter.getMetricsResponse());

  app.route('/', docsRouter);
  app.route('/', httpRouter);
  app.route('/', trpcOpenApiRouter);
  app.route('/trpc', trpcRouter);

  return app;
};

let appPromise: ReturnType<typeof getApp> | undefined = undefined;

const server = {
  async fetch(...args: Parameters<InstanceType<typeof Hono>['fetch']>) {
    appPromise ??= getApp();
    const app = await appPromise;
    return app.fetch(...args);
  },
};

export { getApp, server };
