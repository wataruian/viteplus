import type { NextFunction, Request, Response } from '../types/middlware';
import { loggingOptions, syncLocals } from './gateway-middleware';
import { Buffer } from 'node:buffer';
import { captureResponse } from './capture-response';
import { isTrpcEndpoint } from '@lightproject/common/configs';
import { logger } from '@lightproject/common/logger';
import { safeSerialize } from '@lightproject/common/utils';

const requestHandler = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (isTrpcEndpoint(req.originalUrl) && Buffer.isBuffer(req.body)) {
      req.body = req.body.toString();
    }

    captureResponse(res);

    const metadata: Record<string, unknown> = {
      ...req.locals.metadata,
      body: loggingOptions.logBody === true ? safeSerialize(req.body) : undefined,
      headers: loggingOptions.logHeaders === true ? safeSerialize(req.headers) : undefined,
      params: loggingOptions.logParams === true ? safeSerialize(req.params) : undefined,
      query: loggingOptions.logQuery === true ? safeSerialize(req.query) : undefined,
      source: 'requestHandler',
    };

    syncLocals({
      locals: {
        ...metadata,
      },
      req,
      target: 'req',
    });

    logger.info(`Incoming [${req.method}] request`, req.locals);

    next();
  } catch (error) {
    next(error);
  }
};

export { requestHandler };
