import { Buffer } from 'node:buffer';

import { logger } from '@lightproject/common/logger';
import type express from 'express';

import type { Response } from './initialize-request';

type ResponseChunk = string | Buffer | Uint8Array;
type ChunkParameter = ResponseChunk | (() => void) | undefined;

const isDataChunk = (v: ChunkParameter): v is ResponseChunk =>
  typeof v === 'string' || v instanceof Buffer || v instanceof Uint8Array;

const getCallbackAndEncoding = (
  encodingOrCallback?: ((error: Error | null | undefined) => void) | (() => void) | BufferEncoding,
  callback?: (error: Error | null | undefined) => void,
) => {
  const cb = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
  const enc = typeof encodingOrCallback === 'string' ? encodingOrCallback : 'utf8';
  return { callback: cb, encoding: enc };
};

const captureResponse = (res: Response): void => {
  const { locals } = res;

  const { metadata } = locals;

  Reflect.set(metadata, 'source', 'captureResponse');

  logger.info('Registering response data', locals);

  const write = res.write.bind(res);
  const end = res.end.bind(res);

  let responseBody: Buffer | null | object | string = null;

  const captureChunk = (chunk: ChunkParameter) => {
    if (isDataChunk(chunk)) {
      responseBody = chunk instanceof Buffer ? chunk.toString() : chunk;
    }
  };

  Reflect.set(
    res,
    'write',
    (
      chunk: ResponseChunk,
      encodingOrCallback?: ((error: Error | null | undefined) => void) | BufferEncoding,
      callback?: (error: Error | null | undefined) => void,
    ): boolean => {
      captureChunk(chunk);
      const { callback: cb, encoding: enc } = getCallbackAndEncoding(encodingOrCallback, callback);
      write(chunk, enc, cb);
      return true;
    },
  );

  Reflect.set(
    res,
    'end',
    (
      chunk?: ChunkParameter,
      encodingOrCallback?: (() => void) | BufferEncoding,
      callback?: () => void,
    ): express.Response => {
      if (typeof chunk === 'function') {
        end(chunk);
        return res;
      }
      captureChunk(chunk);
      const { callback: cb, encoding: enc } = getCallbackAndEncoding(encodingOrCallback, callback);
      end(
        isDataChunk(chunk) ? chunk : undefined,
        enc,
        cb
          ? () => {
              cb(undefined);
            }
          : undefined,
      );
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

export { captureResponse, getCallbackAndEncoding, isDataChunk };
export type { ChunkParameter, ResponseChunk };
