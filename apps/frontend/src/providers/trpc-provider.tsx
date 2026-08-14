import type { TrpcRouter } from '@lightproject/backend';
import { trpcUrl } from '@lightproject/common/configs';
import { type TRPCClient, createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

const trpcClient: TRPCClient<TrpcRouter> = createTRPCClient<TrpcRouter>({
  links: [
    httpBatchLink({
      transformer: superjson,
      url: trpcUrl,
    }),
  ],
});

export { trpcClient };
