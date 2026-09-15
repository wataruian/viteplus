import type { AppRouter } from '@lightproject/backend';
import { trpcUrl } from '@lightproject/common/configs';
import { type TRPCClient, createTRPCClient, httpBatchLink } from '@trpc/client';

const trpcClient: TRPCClient<AppRouter> = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: trpcUrl,
    }),
  ],
});

export { trpcClient };
