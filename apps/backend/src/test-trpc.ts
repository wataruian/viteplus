import {
  type Locals,
  type ServiceContext,
  assertIsCustomRequest,
  assertIsCustomResponse,
} from './types/middlware';
import { apiUrl, trpcEndpoint } from '@lightproject/common/configs';
import { createCaller, trpcClient } from './utils/trpc-router';
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

  const requestRaw: unknown = app.makeRequest({
    host: apiUrl,
  });
  assertIsCustomRequest(requestRaw);
  const request = requestRaw;
  request.method = 'GET';
  request.url = trpcEndpoint;
  request.originalUrl = request.url;
  request.locals = locals;

  const responseRaw: unknown = app.makeResponse((_err: Error | null) => {});
  assertIsCustomResponse(responseRaw);
  const response = responseRaw;

  response.locals = locals;

  const ctx: ServiceContext = {
    req: request,
    res: response,
  };

  const trpcCaller = createCaller(ctx);

  const result = await Promise.resolve(
    trpcCaller.test?.hello({
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

const callTrpc = async () => {
  await testCaller();
  await testClient();
};

const start = () => {
  callTrpc().catch((error: unknown) => {
    globalThis.console.error('Failed to call tRPC:', error);
    globalThis.process.exit(1);
  });
};

start();
