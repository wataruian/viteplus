import { getRequestType } from '@lightproject/common/configs';
import { logger, runWithRequestContext, startSpanWithRequestId } from '@lightproject/common/logger';
import {
  type Counter,
  SpanStatusCode,
  context,
  getMeter,
  propagation,
  recordGaugeWithExemplar,
  trace,
} from '@lightproject/common/utils';
import { createMiddleware } from 'hono/factory';
import { routePath } from 'hono/route';

import { getLogUrl } from '../log-url';
import { getRequestStore } from '../request-context';
import type { AppEnv } from '../schema';

let requestHitsCounter: Counter | undefined = undefined;

const requestLogger = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const start = Date.now();

    const { method, path } = c.req;
    const url = getLogUrl(c);

    const requestType = getRequestType(path);

    const requestStore = getRequestStore(c);

    const parentContext = propagation.extract(
      context.active(),
      Object.fromEntries(c.req.raw.headers.entries()),
    );

    const span = startSpanWithRequestId(
      `http.request:${method}`,
      {
        attributes: {
          'http.request.method': method,
          'url.full': url,
          'url.path': path,
        },
      },
      parentContext,
    );

    c.set('span', span);

    const finish = (status: number) => {
      const duration = Date.now() - start;

      span.setAttribute('http.response.status_code', status);
      if (status >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      span.end();

      const metricAttributes = {
        'http.request.method': method,
        'http.response.status_code': status,
        'http.route': routePath(c),
      };

      runWithRequestContext(span, requestStore, () => {
        recordGaugeWithExemplar({
          attributes: metricAttributes,
          description: 'Duration of the most recently completed HTTP request',
          name: 'http_server_duration_seconds',
          unit: 's',
          value: duration / 1000,
        }).catch(() => {
          // Skip exemplar metric if it fails
        });
      });

      if (status < 400) {
        runWithRequestContext(span, requestStore, () => {
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
    };

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

      try {
        await next();
      } catch (error) {
        span.recordException(error instanceof Error ? error : String(error));
        runWithRequestContext(span, requestStore, () => {
          logger.error(`Unhandled error: [${method}] ${url}`, { err: error, method, path, url });
        });
        finish(500);
        throw error;
      }
      finish(c.res.status);
    });
  });

export { requestLogger };
