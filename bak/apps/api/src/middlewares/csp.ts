import type {
  ExpressNextFunction,
  ExpressRequest,
  ExpressResponse,
} from '../types/middlware';

import { allowedOrigins } from '../utils/cors';

export const allowedCsp = [...allowedOrigins];

export const cspMiddleware = (
  _req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNextFunction
) => {
  let csp = '';
  for (const origin of allowedCsp) {
    csp += `default-src 'self'; script-src 'self' ${origin}; worker-src 'self' ${origin}; `;
  }

  csp = csp.trim();

  res.setHeader('Content-Security-Policy', csp);

  next();
};
