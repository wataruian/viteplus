import { Buffer } from 'node:buffer';
import { utils } from '@lightproject/common';
import { endpoints } from '@lightproject/common/configs';
import { logger } from '@lightproject/common/logger';

import type { NextFunction, Request, Response } from '../types/middlware';

import { captureResponse } from './capture-response';
import { loggingOptions, syncLocals } from './gateway-middleware';

export const requestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (
      endpoints.isTrpcEndpoint(req.originalUrl) &&
      req.body &&
      Buffer.isBuffer(req.body)
    ) {
      req.body = req.body.toString();
    }

    captureResponse(res);

    const metadata: Record<string, unknown> = {
      ...req.locals.metadata,
      body: loggingOptions.logBody
        ? utils.serialize.safeSerialize(req.body)
        : undefined,
      headers: loggingOptions.logHeaders
        ? utils.serialize.safeSerialize(req.headers)
        : undefined,
      params: loggingOptions.logParams
        ? utils.serialize.safeSerialize(req.params)
        : undefined,
      query: loggingOptions.logQuery
        ? utils.serialize.safeSerialize(req.query)
        : undefined,
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
