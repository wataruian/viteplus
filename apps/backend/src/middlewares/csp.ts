import { uniqueOrigins } from '../utils/cors';
import type { NextFunction, Request, Response } from './initialize-request';

const allowedCsp = [...uniqueOrigins];

const cspMiddleware = (_req: Request, res: Response, next: NextFunction) => {
  let csp = '';

  for (const origin of allowedCsp) {
    csp += `default-src 'self'; script-src 'self' ${origin}; worker-src 'self' ${origin}; `;
  }

  csp = csp.trim();

  res.setHeader('Content-Security-Policy', csp);

  next();
};

export { allowedCsp, cspMiddleware };
