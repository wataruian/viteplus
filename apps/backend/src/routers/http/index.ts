import { getEnv, isTest, isTrue } from '@lightproject/common/environment';

import type { RouteHandler } from '../../middlewares/initialize-request';
import defaultRoutes from './routes/default';
import testRoutes from './routes/test';

const getHttpRouter = () => {
  const router: Record<string, { handler: RouteHandler; method: string }>[] = [defaultRoutes];
  const includeTestRoutes = isTrue(getEnv('ENABLE_TEST_ROUTES')) || isTest();
  if (includeTestRoutes) {
    router.push(testRoutes);
  }
  return router;
};

export { getHttpRouter };
