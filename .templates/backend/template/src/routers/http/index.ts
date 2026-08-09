import { getEnv, isTest, isTrue } from '@lightproject/common/environment';
import type { RouteHandler } from '../../types/middlware';
import defaultRoutes from './routes/default';
import testRoutes from './routes/test';

const httpRouter: Record<string, { handler: RouteHandler; method: string }>[] = [defaultRoutes];

const includeTestRoutes = isTrue(getEnv('ENABLE_TEST_ROUTES')) || isTest();

if (includeTestRoutes) {
  httpRouter.push(testRoutes);
}

type HttpRouter = typeof httpRouter;

export type { HttpRouter };
export { includeTestRoutes, httpRouter };
