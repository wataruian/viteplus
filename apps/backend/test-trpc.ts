import type { Locals, Request, Response, ServiceContext } from './src/types/middlware';
import { apiUrl, trpcEndpoint } from '@lightproject/common/configs';
import { createCaller, trpcClient } from './src/utils/trpc-router';
import MockExpress from 'mock-express';

const testCaller = async () => {
  const app = MockExpress();

  const locals: Locals = {
    metadata: {
      method: 'POST',
      requestType: 'tRPC',
      startTime: Date.now(),
      url: trpcEndpoint,
    },
    sessionId: 'test',
  };

  const request = app.makeRequest({
    host: apiUrl,
  }) as unknown as Request;
  request.method = 'GET';
  request.url = trpcEndpoint;
  request.originalUrl = request.url;
  request.locals = locals;

  const response = app.makeResponse((_err: Error | null) => {}) as unknown as Response;

  response.locals = locals;

  const ctx: ServiceContext = {
    req: request,
    res: response,
  };

  const trpcCaller = createCaller(ctx);

  if (!trpcCaller.test) {
    throw new Error('tRPC test endpoint not found');
  }

  if (!trpcCaller.test.hello) {
    throw new Error('tRPC test.hello endpoint not found');
  }

  const result = await Promise.resolve(
    trpcCaller.test.hello({
      firstName: 'Test',
      lastName: 'World',
    }),
  );

  globalThis.console.log('tRPC Caller Result:', result);
};

const testClient = async () => {
  const result = await Promise.resolve(trpcClient.test.hello.mutate({ firstName: 'Test' }));

  globalThis.console.log('tRPC Client Result:', result);
};

const main = async () => {
  await testCaller();
  await testClient();
};

try {
  await main();
} catch (error) {
  globalThis.console.error('Error in tRPC tests:', error);
}
