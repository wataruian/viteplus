import { setClientId, startRequestScope } from '@lightproject/common/logger';
import { initializeContextPropagation, resetTelemetryForTests } from '@lightproject/common/server';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vite-plus/test';

import {
  type TrpcClientOptions,
  createAppTrpcClient,
  trpcClient,
} from '../../src/providers/trpc-provider';

const successBody = {
  result: {
    data: {
      code: 200,
      data: { reply: 'Hello Test!' },
      message: 'Success',
      requestId: 'r',
      success: true,
    },
  },
};

type TrpcFetch = NonNullable<TrpcClientOptions['fetch']>;

const createRecordingClient = () => {
  const fetchMock = vi.fn<TrpcFetch>(
    async () => await Promise.resolve(globalThis.Response.json(successBody)),
  );
  const client = createAppTrpcClient({ fetch: fetchMock, url: 'http://backend.test/trpc' });
  const sentHeader = (name: string) =>
    fetchMock.mock.calls.map(([, init]) => new globalThis.Headers(init?.headers).get(name));
  const sentRequestIds = () => sentHeader('X-Request-Id');
  const sentClientIds = () => sentHeader('X-Client-Id');
  return { client, fetchMock, sentClientIds, sentRequestIds };
};

describe('trpcClient', () => {
  beforeAll(() => {
    initializeContextPropagation();
  });

  afterAll(() => {
    resetTelemetryForTests();
  });

  test('is created with a callable test.hello query procedure', () => {
    expect(typeof trpcClient.test.hello.query).toBe('function');
  });

  test('sends the requestId of the scope a call was made in as X-Request-Id, one request per call', async () => {
    const { client, sentRequestIds } = createRecordingClient();
    const first = startRequestScope('first');
    const second = startRequestScope('second');

    await Promise.all([
      first.run(async () => await client.test.hello.query({ name: 'a' })),
      second.run(async () => await client.test.hello.query({ name: 'b' })),
    ]);

    expect(sentRequestIds()).toStrictEqual([first.requestId, second.requestId]);
    first.span.end();
    second.span.end();
  });

  test('sends no X-Request-Id outside a request scope, so the backend generates one', async () => {
    const { client, fetchMock, sentRequestIds } = createRecordingClient();

    await client.test.hello.query({ name: 'a' });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(sentRequestIds()).toStrictEqual([null]);
  });

  test('sends the page clientId as X-Client-Id, and omits it when none is set', async () => {
    const { client, sentClientIds } = createRecordingClient();

    setClientId('page-client-id');
    await client.test.hello.query({ name: 'a' });
    setClientId(undefined);
    await client.test.hello.query({ name: 'b' });

    expect(sentClientIds()).toStrictEqual(['page-client-id', null]);
  });
});
