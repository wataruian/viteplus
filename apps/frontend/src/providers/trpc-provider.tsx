import type { AppRouter } from '@lightproject/backend';
import { trpcUrl } from '@lightproject/common/configs';
import { getClientId, getRequestId } from '@lightproject/common/logger';
import { type TRPCClient, type TRPCLink, createTRPCClient, httpLink } from '@trpc/client';

type TrpcClientOptions = Pick<Parameters<typeof httpLink<AppRouter>>[0], 'fetch' | 'url'>;

const requestIdLink: TRPCLink<AppRouter> =
  () =>
  ({ next, op }) => {
    const requestId = getRequestId();
    const clientId = getClientId();
    return next({
      ...op,
      context: {
        ...op.context,
        ...(requestId === 'no-id' ? {} : { requestId }),
        ...(clientId === undefined ? {} : { clientId }),
      },
    });
  };

const createAppTrpcClient = (options: TrpcClientOptions): TRPCClient<AppRouter> =>
  createTRPCClient<AppRouter>({
    links: [
      requestIdLink,
      httpLink({
        ...options,
        headers: ({ op }) => {
          const { clientId, requestId } = op.context;
          return {
            ...(typeof requestId === 'string' ? { 'X-Request-Id': requestId } : {}),
            ...(typeof clientId === 'string' ? { 'X-Client-Id': clientId } : {}),
          };
        },
      }),
    ],
  });

const trpcClient: TRPCClient<AppRouter> = createAppTrpcClient({ url: trpcUrl });

export { createAppTrpcClient, requestIdLink, trpcClient };
export type { TrpcClientOptions };
