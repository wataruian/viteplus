import { ROOT_CONTEXT } from '@opentelemetry/api';
import { BasicTracerProvider, type ReadableSpan } from '@opentelemetry/sdk-trace-web';
import { afterEach, describe, expect, test } from 'vite-plus/test';

import { REQUEST_CONTEXT_KEY, setClientId, setRequestId } from '../../src/logger/context';
import { requestContextSpanProcessor } from '../../src/server/request-context-span-processor';

const ended: ReadableSpan[] = [];
const tracer = new BasicTracerProvider({
  spanProcessors: [
    requestContextSpanProcessor,
    {
      forceFlush: async () => {
        await Promise.resolve();
      },
      onEnd: (span) => {
        ended.push(span);
      },
      onStart: () => {
        // Only ended spans are inspected.
      },
      shutdown: async () => {
        await Promise.resolve();
      },
    },
  ],
}).getTracer('test');

const attributesOf = (name: string, attributes = {}, ctx = ROOT_CONTEXT) => {
  tracer.startSpan(name, { attributes }, ctx).end();
  return ended.at(-1)?.attributes;
};

afterEach(() => {
  ended.length = 0;
  setClientId(undefined);
  setRequestId(undefined);
});

describe('requestContextSpanProcessor', () => {
  test('tags spans started inside a request with its request.id and client.id', () => {
    const ctx = ROOT_CONTEXT.setValue(REQUEST_CONTEXT_KEY, {
      clientId: 'client-1',
      requestId: 'req-1',
    });

    expect(attributesOf('fetch', {}, ctx)).toStrictEqual({
      'client.id': 'client-1',
      'request.id': 'req-1',
    });
  });

  test('falls back to the pinned ids outside a request', () => {
    setClientId('page-client');

    expect(attributesOf('startup')).toStrictEqual({ 'client.id': 'page-client' });
  });

  test('adds nothing when there are no ids at all', () => {
    expect(attributesOf('startup', { foo: 'bar' })).toStrictEqual({ foo: 'bar' });
  });

  test('keeps ids a span already set explicitly', () => {
    const ctx = ROOT_CONTEXT.setValue(REQUEST_CONTEXT_KEY, {
      clientId: 'client-1',
      requestId: 'req-1',
    });

    expect(
      attributesOf('explicit', { 'client.id': 'own-client', 'request.id': 'own-req' }, ctx),
    ).toStrictEqual({ 'client.id': 'own-client', 'request.id': 'own-req' });
  });

  test('forceFlush and shutdown resolve (nothing is buffered)', async () => {
    await expect(requestContextSpanProcessor.forceFlush()).resolves.toBeUndefined();
    await expect(requestContextSpanProcessor.shutdown()).resolves.toBeUndefined();
  });
});
