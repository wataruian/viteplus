import type { NextFunction, Request, Response } from '../types/middlware';
import { loggingOptions, syncLocals } from './gateway-middleware';
import { isTrpcEndpoint } from '@lightproject/common/configs';
import { logger } from '@lightproject/common/logger';
import { safeSerialize } from '@lightproject/common/utils';

const responseHandler = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.locals?.metadata?.error && res.statusCode < 400) {
      const endTime = Date.now();
      const startTime = req.locals?.metadata?.startTime;
      const duration = startTime ? endTime - startTime : undefined;

      const responseBody = res.locals.responseBody || undefined;

      const metadata: Record<string, unknown> = {
        ...req.locals.metadata,
        body: loggingOptions.logBody ? safeSerialize(req.body) : undefined,
        duration,
        endTime,
        headers: loggingOptions.logHeaders ? safeSerialize(res.getHeaders()) : undefined,
        params: loggingOptions.logParams ? safeSerialize(req.params) : undefined,
        query: loggingOptions.logQuery ? safeSerialize(req.query) : undefined,
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
      res.locals &&
      req.locals.metadata &&
      req.locals.metadata.error
    ) {
      next(req.locals.metadata.error);
    }
  } catch (error) {
    next(error);
  }
};

export { responseHandler };
