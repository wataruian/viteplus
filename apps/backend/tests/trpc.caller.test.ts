import type {
  Locals,
  Request,
  Response,
  ServiceContext,
} from '../src/middlewares/initialize-request';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { trpcEndpoint, trpcUrl } from '@lightproject/common/configs';
import type { Server } from 'node:http';
import type { TrpcRouter } from '../src/routers/trpc';
import { URL } from 'node:url';
import { createApp } from '../src/main';
import { createCaller } from '../src/utils/trpc-router';
import { transformer } from '../src/utils/trpc';

describe('tRPC Integration Tests', () => {
  let server: Server | undefined = undefined;

  beforeAll(async () => {
    vi.stubEnv('ENABLE_TEST_ROUTES', 'true');

    const urlObj = new URL(trpcUrl);
    const port = urlObj.port ? Number(urlObj.port) : 3000;

    const appInstance = await createApp();

    server = await new Promise<Server>((resolve) => {
      const s = appInstance.listen(port, () => {
        resolve(s);
      });
    });
  });

  afterAll(async () => {
    const s = server;
    if (s !== undefined) {
      await new Promise<void>((resolve) => {
        s.close(() => {
          resolve();
        });
      });
    }
  });

  it('should call tRPC using direct caller (createCaller)', async () => {
    const locals: Locals = {
      metadata: {
        method: 'POST',
        requestType: 'tRPC',
        source: 'test',
        startTime: Date.now(),
        url: trpcEndpoint,
      },
      sessionId: 'test',
    };

    const requestBase: Partial<Request> = {};
    const request: Request = Object.assign(
      requestBase,
      {
        locals,
        method: 'GET',
        originalUrl: trpcEndpoint,
        url: trpcEndpoint,
      },
      vi.fn<() => Request>()(),
    );

    const responseBase: Partial<Response> = {};
    const response: Response = Object.assign(
      responseBase,
      {
        locals,
      },
      vi.fn<() => Response>()(),
    );

    const ctx: ServiceContext = {
      req: request,
      res: response,
    };

    const trpcCaller = createCaller(ctx);

    const result = await trpcCaller.test?.hello({
      firstName: 'Test',
      lastName: 'World',
    });

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      code: 200,
      data: { customMessage: 'Hello, Test World!' },
      success: true,
    });
  });

  it('should call tRPC using HTTP client (createTRPCClient)', async () => {
    const trpcClient = createTRPCClient<TrpcRouter>({
      links: [
        httpBatchLink({
          transformer,
          url: trpcUrl,
        }),
      ],
    });

    const result = await trpcClient.test.hello.mutate({ firstName: 'Test' });

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      code: 200,
      data: { customMessage: 'Hello, Test!' },
      success: true,
    });
  });
});
