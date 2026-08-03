import { type RequestContext, logger, requestContextStorage } from '@lightproject/common/logger';
import {
  context,
  generateUuid,
  getNextRandomColor,
  trace,
  tracer,
} from '@lightproject/common/utils';
import type { Locals } from '../types/middlware';
import type express from 'express';
import { getRequestType } from '@lightproject/common/configs';

let lastColor: ((text: string) => string) | undefined = undefined;

const initializeRequest = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  try {
    const sessionId = generateUuid();

    const initialLocals: Locals = {
      metadata: {
        method: req.method,
        requestType: getRequestType(req.originalUrl),
        source: 'initializeRequest',
        startTime: Date.now(),
        url: req.originalUrl,
      },
      sessionId,
    };

    Reflect.set(req, 'locals', initialLocals);
    Reflect.set(res, 'locals', initialLocals);

    const span = tracer.startSpan(`http.request:${req.method}`, {
      attributes: {
        'http.method': req.method,
        'http.path': req.path,
        'http.url': req.originalUrl,
        'session.id': sessionId,
      },
    });

    res.on('finish', () => {
      span.setAttribute('http.status_code', res.statusCode);
      span.end();
    });

    res.on('close', () => {
      if (span.isRecording()) {
        span.end();
      }
    });

    const { nextColor } = getNextRandomColor(sessionId, lastColor);
    lastColor = nextColor;

    context.with(trace.setSpan(context.active(), span), () => {
      const contextStore: RequestContext = {
        ...initialLocals,
        color: nextColor,
        sessionId,
      };
      requestContextStorage.run(contextStore, () => {
        logger.info(`Initializing [${req.method}] request session`, initialLocals);
        next();
      });
    });
  } catch (error) {
    next(error);
  }
};

export { initializeRequest };
