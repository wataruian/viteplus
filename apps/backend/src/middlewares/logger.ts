import { getRequestType } from '@lightproject/common/configs';
import { getSessionId, logger, requestContextStorage } from '@lightproject/common/logger';
import { type Counter, getMeter, tracer } from '@lightproject/common/utils';
import { createMiddleware } from 'hono/factory';

let requestHitsCounter: Counter | undefined = undefined;

const requestLogger = () =>
  createMiddleware(async (c, next) => {
    const start = Date.now();

    const { method, url, path } = c.req;

    const requestType = getRequestType(url);

    const sessionId = getSessionId();

    logger.info(`Incoming Request: [${method}] ${url}`, {
      method,
      path,
      requestType,
      url,
    });

    const span = tracer.startSpan(`http.request:${method}`, {
      attributes: {
        'http.method': method,
        'http.path': path,
        'http.url': url,
        'session.id': sessionId,
      },
      root: true,
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

    if (status < 400) {
      requestContextStorage.run({ sessionId }, () => {
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

export { requestLogger };
