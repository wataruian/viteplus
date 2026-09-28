import { adminUrl, apiBaseUrl, docsEndpoint, siteUrl } from '@lightproject/common/configs';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import { secureHeaders } from 'hono/secure-headers';

import { config } from '../config';

const allowedOrigins: string[] = [];

if (apiBaseUrl) {
  allowedOrigins.push(apiBaseUrl);
}

if (adminUrl) {
  allowedOrigins.push(adminUrl);
}

if (siteUrl) {
  allowedOrigins.push(siteUrl);
}

const additionalOrigins = config.additionalCorsOrigins;
if (additionalOrigins !== undefined && additionalOrigins !== '') {
  allowedOrigins.push(...additionalOrigins.split(','));
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
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
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
  corsMiddleware,
  cspMiddleware,
  isDocsPath,
  uniqueOrigins,
};
