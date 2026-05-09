import { Buffer } from 'node:buffer';
import type { Response } from '../types/middlware';
import { logger } from '@lightproject/common/logger';

const captureResponse = (res: Response): void => {
  if (res.locals?.metadata) {
    res.locals.metadata['source'] = 'captureResponse';
  }

  logger.info('Registering response data', res.locals);

  const originalSend = res.send;
  const originalJson = res.json;
  const originalWrite = res.write;
  const originalEnd = res.end;

  let responseBody: Buffer | null | object | string = null;

  res.send = (body: Buffer | object | string): Response => {
    if (body) {
      responseBody = body;
    }
    return originalSend.call(res, body);
  };

  res.json = (body: object): Response => {
    if (body) {
      responseBody = body;
    }
    return originalJson.call(res, body);
  };

  res.write = (
    chunk: string | Buffer | Uint8Array,
    encodingOrCallback?: ((error: Error | null | undefined) => void) | BufferEncoding,
    callback?: (error: Error | null | undefined) => void,
  ): boolean => {
    if (chunk) {
      const chunkString = chunk instanceof Buffer ? chunk.toString() : chunk;
      responseBody = chunkString;
    }

    if (typeof encodingOrCallback === 'function') {
      return originalWrite.call(res, chunk, '' as BufferEncoding, encodingOrCallback);
    }

    return originalWrite.call(
      res,
      chunk,
      (encodingOrCallback ?? 'utf8') as BufferEncoding,
      callback,
    );
  };

  res.end = (
    chunk?: string | Buffer | Uint8Array | (() => void),
    encodingOrCallback?: (() => void) | BufferEncoding,
    callback?: () => void,
  ): Response => {
    if (chunk && typeof chunk !== 'function') {
      const chunkString = chunk instanceof Buffer ? chunk.toString() : chunk;
      responseBody = chunkString;
    }

    if (typeof chunk === 'function') {
      return originalEnd.call(res, undefined, 'utf8', chunk);
    }

    if (typeof encodingOrCallback === 'function') {
      return originalEnd.call(res, chunk, 'utf8', encodingOrCallback);
    }

    return originalEnd.call(res, chunk, (encodingOrCallback ?? 'utf8') as BufferEncoding, callback);
  };

  Object.defineProperty(res, 'responseBody', {
    configurable: true,
    enumerable: true,
    get: () => responseBody,
    set: (body: Buffer | null | object | string) => {
      responseBody = body;
    },
  });
};

export { captureResponse };
