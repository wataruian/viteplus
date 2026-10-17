import { backendBaseUrl, docsEndpoint, frontendUrl } from '@lightproject/common/configs';
import { isLocalOrTest } from '@lightproject/common/environment';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import { secureHeaders } from 'hono/secure-headers';

import { config } from '../config';

const loopbackHosts: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

const isLoopbackOrigin = (origin: string): boolean => {
  try {
    return loopbackHosts.has(new globalThis.URL(origin).hostname);
  } catch {
    return false;
  }
};

const allowLoopbackOrigins = isLocalOrTest();

const allowedOrigins: string[] = [backendBaseUrl, frontendUrl].filter(
  (origin) => origin !== '' && (allowLoopbackOrigins || !isLoopbackOrigin(origin)),
);

const additionalOrigins = config.additionalCorsOrigins;
if (additionalOrigins !== undefined && additionalOrigins !== '') {
  allowedOrigins.push(
    ...additionalOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ''),
  );
}

const uniqueOrigins = [...new Set(allowedOrigins)];

const corsMiddleware = () =>
  cors({
    allowHeaders: [
      'Origin',
      'X-Requested-With',
      'Accept',
      'Authorization',
      'Content-Type',
      'traceparent',
      'tracestate',
      'X-Request-Id',
      'X-Client-Id',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    exposeHeaders: ['X-Request-Id'],
    maxAge: 600,
    origin: uniqueOrigins,
  });

const isDocsPath = (path: string) => path === docsEndpoint || path.startsWith(`${docsEndpoint}/`);

const cspMiddleware = () => {
  const strict = secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", ...uniqueOrigins],
      styleSrc: ["'self'"],
      workerSrc: ["'self'", ...uniqueOrigins],
    },
  });

  const docs = secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', ...uniqueOrigins],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      workerSrc: ["'self'", ...uniqueOrigins],
    },
  });

  return createMiddleware(async (c, next) => {
    await (isDocsPath(c.req.path) ? docs(c, next) : strict(c, next));
  });
};

export {
  additionalOrigins,
  allowedOrigins,
  allowLoopbackOrigins,
  corsMiddleware,
  cspMiddleware,
  isDocsPath,
  isLoopbackOrigin,
  loopbackHosts,
  uniqueOrigins,
};
