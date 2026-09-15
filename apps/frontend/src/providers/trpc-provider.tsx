import type { AppRouter } from '@lightproject/backend';
import { type TRPCClient, createTRPCClient, httpBatchLink } from '@trpc/client';

import { config } from '../config';

const trpcClient: TRPCClient<AppRouter> = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: config.trpcUrl,
    }),
  ],
});

export { trpcClient };
