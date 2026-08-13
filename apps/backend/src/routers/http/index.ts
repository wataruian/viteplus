import { isTest } from '@lightproject/common/environment';

import { config } from '../../config';
import type { RouteHandler } from '../../middlewares/initialize-request';
import defaultRoutes from './routes/default';
import testRoutes from './routes/test';

const getHttpRouter = () => {
  const router: Record<string, { handler: RouteHandler; method: string }>[] = [defaultRoutes];
  const includeTestRoutes = config.enableTestRoutes || isTest();
  if (includeTestRoutes) {
    router.push(testRoutes);
  }
  return router;
};

export { getHttpRouter };
