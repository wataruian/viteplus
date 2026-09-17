import { getRequestType } from '@lightproject/common/configs';
import {
  getSessionId,
  logger,
  runWithRequestContext,
  startSpanWithSession,
} from '@lightproject/common/logger';
import { recordGaugeWithExemplar } from '@lightproject/common/server';
import { type Counter, context, getMeter, propagation, trace } from '@lightproject/common/utils';
import { createMiddleware } from 'hono/factory';

import type { AppEnv } from '../schema';

let requestHitsCounter: Counter | undefined = undefined;

const requestLogger = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const start = Date.now();

    const { method, url, path } = c.req;

    const requestType = getRequestType(url);

    const sessionId = getSessionId();

    const parentContext = propagation.extract(
      context.active(),
      Object.fromEntries(c.req.raw.headers.entries()),
    );

    const span = startSpanWithSession(
      `http.request:${method}`,
      {
        attributes: {
          'http.method': method,
          'http.path': path,
          'http.url': url,
        },
      },
      parentContext,
    );

    c.set('span', span);

    await context.with(trace.setSpan(parentContext, span), async () => {
      logger.info(`Incoming Request: [${method}] ${url}`, {
        method,
        path,
        requestType,
        url,
      });

      try {
        requestHitsCounter ??= getMeter().createCounter('request_hits', {
          description: 'request_hits',
        });
        requestHitsCounter.add(1);
        logger.info('Pushed request_hits metric');
      } catch {
        // Skip metric counter if it fails
      }

      await next();

      const duration = Date.now() - start;
      const { status } = c.res;

      span.setAttribute('http.status_code', status);
      span.end();

      runWithRequestContext(span, { sessionId }, () => {
        recordGaugeWithExemplar({
          attributes: {
            'http.method': method,
            'http.route': c.req.routePath,
            'http.status_code': status,
          },
          description: 'Duration of the most recently completed HTTP request',
          name: 'http_server_duration_seconds',
          unit: 's',
          value: duration / 1000,
        }).catch(() => {
          // Skip exemplar metric if it fails
        });
      });

      if (status < 400) {
        runWithRequestContext(span, { sessionId }, () => {
          logger.info(`Outgoing Response: [${method}] ${url} [${status}]`, {
            duration,
            method,
            path,
            requestType,
            status,
            url,
          });
        });
      }
    });
  });

export { requestLogger };
