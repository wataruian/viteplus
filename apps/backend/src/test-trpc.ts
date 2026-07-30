import {
  type Locals,
  type ServiceContext,
  assertIsCustomRequest,
  assertIsCustomResponse,
} from './types/middlware';
import { apiUrl, trpcEndpoint, trpcUrl } from '@lightproject/common/configs';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import MockExpress from 'mock-express';
import type { Server } from 'node:http';
import type { TrpcRouter } from './routers/trpc';
import { URL } from 'node:url';
import { createApp } from './main';
import { createCaller } from './utils/trpc-router';
import { transformer } from './utils/trpc';

globalThis.process.env['ENABLE_TEST_ROUTES'] = 'true';

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
  const localTrpcClient = createTRPCClient<TrpcRouter>({
    links: [
      httpBatchLink({
        transformer,
        url: trpcUrl,
      }),
    ],
  });

  const result = await Promise.resolve(localTrpcClient.test.hello.mutate({ firstName: 'Test' }));

  globalThis.console.log('tRPC Client Result:', result);
};

const callTrpc = async () => {
  let server: Server | undefined = undefined;

  try {
    const urlObj = new URL(trpcUrl);
    const port = urlObj.port ? Number(urlObj.port) : 3000;

    const appInstance = await createApp();
    server = await new Promise<Server>((resolve) => {
      const s = appInstance.listen(port, () => {
        resolve(s);
      });
    });

    await testCaller();
    await testClient();
  } catch (error: unknown) {
    globalThis.console.error('Failed to call tRPC:', error);
    if (server !== undefined) {
      server.close();
    }
    globalThis.process.exit(1);
  } finally {
    if (server !== undefined) {
      server.close();
    }
  }
};

const start = () => {
  callTrpc().catch((error: unknown) => {
    globalThis.console.error('Failed to call tRPC:', error);
    globalThis.process.exit(1);
  });
};

start();
