import { logger, requestContextStorage } from '@lightproject/common/logger';
import {
  flushTelemetry,
  initializeTelemetry,
  prometheusExporter,
} from '@lightproject/common/server';
import { generateUuid } from '@lightproject/common/utils';
import { Hono } from 'hono';
import { trimTrailingSlash } from 'hono/trailing-slash';

import packageJson from '../package.json' with { type: 'json' };
import { config, get } from './config';
import { globalErrorHandler, notFoundHandler } from './middlewares/error-handler';
import { requestLogger } from './middlewares/logger';
import { corsMiddleware, cspMiddleware } from './middlewares/security';
import { trustProxy } from './middlewares/trust-proxy';
import { docsRouter } from './routers/docs';
import { httpRouter } from './routers/http';
import { trpcOpenApiRouter, trpcRouter } from './routers/trpc';

const getApp = async () => {
  const port = get('API_PORT');
  if (port !== undefined && port !== '') {
    logger.info(`API_PORT is set: ${port}`);
  } else {
    logger.info(`API_PORT is not set, using default port: ${config.apiPort}`);
  }

  await initializeTelemetry({
    serviceName: packageJson.name,
    serviceVersion: packageJson.version,
  });

  const app = new Hono<{ Variables: { sessionId: string } }>();

  app.use('*', async (c, next) => {
    const sessionId = generateUuid();
    c.set('sessionId', sessionId);
    await requestContextStorage.run({ sessionId }, async () => {
      await next();
    });
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
    } else {
      flushTelemetry().catch(() => {});
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
