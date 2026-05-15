import type { NextFunction, Request, Response } from '../types/middlware';
import { loggingOptions, syncLocals } from './gateway-middleware';
import { isTrpcEndpoint } from '@lightproject/common/configs';
import { logger } from '@lightproject/common/logger';
import { safeSerialize } from '@lightproject/common/utils';

const responseHandler = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (
      (req.locals.metadata.error === undefined || req.locals.metadata.error === null) &&
      res.statusCode < 400
    ) {
      const endTime = Date.now();
      const { startTime } = req.locals.metadata;
      const duration = startTime === 0 ? undefined : endTime - startTime;

      const responseBody = res.locals.responseBody ?? undefined;

      const metadata: Record<string, unknown> = {
        ...req.locals.metadata,
        body: loggingOptions.logBody === true ? safeSerialize(req.body) : undefined,
        duration,
        endTime,
        headers: loggingOptions.logHeaders === true ? safeSerialize(res.getHeaders()) : undefined,
        params: loggingOptions.logParams === true ? safeSerialize(req.params) : undefined,
        query: loggingOptions.logQuery === true ? safeSerialize(req.query) : undefined,
        responseBody,
        source: 'responseHandler',
        statusCode: res.statusCode,
      };

      syncLocals({
        locals: {
          ...metadata,
        },
        res,
        target: 'res',
      });

      logger.info(
        `Response completed for [${req.method}] request with status: ${res.statusCode}`,
        res.locals,
      );

      next();
    } else if (
      isTrpcEndpoint(req.originalUrl) &&
      req.locals.metadata.error !== undefined &&
      req.locals.metadata.error !== null
    ) {
      next(req.locals.metadata.error);
    }
  } catch (error) {
    next(error);
  }
};

export { responseHandler };
