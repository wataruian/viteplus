import { endpoints } from '@lightproject/common/configs';
// @ts-expect-error
import MockExpress from 'mock-express';

import type {
  Locals,
  Request,
  Response,
  ServiceContext,
} from './src/types/middlware';

import { createCaller, trpcClient } from './src/utils/trpc-router';

const testCaller = async () => {
  console.info('Testing tRPC caller...');

  const app = MockExpress();

  const locals: Locals = {
    metadata: {
      method: 'POST',
      requestType: 'tRPC',
      startTime: Date.now(),
      url: endpoints.trpcEndpoint,
    },
    sessionId: 'test',
  };

  const request = app.makeRequest({
    host: endpoints.apiUrl,
  }) as unknown as Request;
  request.method = 'GET';
  request.url = endpoints.trpcEndpoint;
  request.originalUrl = request.url;
  request.locals = locals;

  const response = app.makeResponse((err: Error | null) => {
    if (err) {
      console.error('Response error:', err);
    }
  }) as unknown as Response;

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
    })
  );

  console.info('Test result:', result);
};

const testClient = async () => {
  console.info('Testing tRPC client...');

  const result = await Promise.resolve(
    trpcClient.test.hello.mutate({ firstName: 'Test' })
  );

  console.info('Test result:', result);
};

const main = async () => {
  console.info('Starting tRPC test...');

  await testCaller();
  await testClient();

  console.info('tRPC test completed successfully');
};

main()
  .then(() => {
    console.info('Test completed successfully');
    return;
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
