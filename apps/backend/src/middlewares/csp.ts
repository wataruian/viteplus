import type { ExpressNextFunction, ExpressRequest, ExpressResponse } from '../types/middlware';

import { uniqueOrigins } from '../utils/cors';

const allowedCsp = [...uniqueOrigins];

const cspMiddleware = (_req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
  let csp = '';
  for (const origin of allowedCsp) {
    csp += `default-src 'self'; script-src 'self' ${origin}; worker-src 'self' ${origin}; `;
  }

  csp = csp.trim();

  res.setHeader('Content-Security-Policy', csp);

  next();
};

export { allowedCsp, cspMiddleware };
