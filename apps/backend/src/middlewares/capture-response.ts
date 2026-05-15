import { Buffer } from 'node:buffer';
import type express from 'express';
import { isLocals } from '../types/middlware';
import { isRecord } from '@lightproject/common/validators';
import { logger } from '@lightproject/common/logger';

const isDataChunk = (v: unknown): v is string | Buffer | Uint8Array =>
  typeof v === 'string' || v instanceof Buffer || v instanceof Uint8Array;

const captureResponse = (res: express.Response): void => {
  const locals = Reflect.get(res, 'locals') as unknown;
  if (isLocals(locals)) {
    const metadata = locals.metadata as unknown;
    if (isRecord(metadata)) {
      Reflect.set(metadata, 'source', 'captureResponse');
    }
    logger.info('Registering response data', locals);
  }

  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  let responseBody: Buffer | null | object | string = null;

  Reflect.set(
    res,
    'write',
    (
      chunk: string | Buffer | Uint8Array,
      encodingOrCallback?: ((error: Error | null | undefined) => void) | BufferEncoding,
      callback?: (error: Error | null | undefined) => void,
    ): boolean => {
      const chunkString = chunk instanceof Buffer ? chunk.toString() : chunk;
      responseBody = chunkString;

      if (typeof encodingOrCallback === 'function') {
        originalWrite(chunk, 'utf8', encodingOrCallback);
        return true;
      }

      originalWrite(chunk, encodingOrCallback ?? 'utf8', callback);
      return true;
    },
  );

  Reflect.set(
    res,
    'end',
    (
      chunk?: string | Buffer | Uint8Array | (() => void),
      encodingOrCallback?: (() => void) | BufferEncoding,
      callback?: () => void,
    ): express.Response => {
      if (typeof chunk === 'function') {
        originalEnd(chunk);
        return res;
      }

      if (isDataChunk(chunk)) {
        const chunkString = chunk instanceof Buffer ? chunk.toString() : chunk;
        responseBody = chunkString;
      }

      if (typeof encodingOrCallback === 'function') {
        if (isDataChunk(chunk)) {
          originalEnd(chunk, 'utf8', encodingOrCallback);
        } else {
          originalEnd(undefined, 'utf8', encodingOrCallback);
        }
        return res;
      }

      if (isDataChunk(chunk)) {
        originalEnd(chunk, encodingOrCallback ?? 'utf8', callback);
      } else {
        originalEnd(undefined, encodingOrCallback ?? 'utf8', callback);
      }
      return res;
    },
  );

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
