import type { TrpcRouter } from '@lightproject/backend';
import { trpcUrl } from '@lightproject/common/configs';
import { type TRPCClient, createTRPCClient, httpBatchLink } from '@trpc/client';

const trpcClient: TRPCClient<TrpcRouter> = createTRPCClient<TrpcRouter>({
  links: [
    httpBatchLink({
      url: trpcUrl,
    }),
  ],
});

export { trpcClient };
