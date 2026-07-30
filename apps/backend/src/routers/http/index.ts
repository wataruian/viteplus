import { getEnv, isTest } from '@lightproject/common/environment';
import defaultRoutes from './routes/default';
import testRoutes from './routes/test';

const httpRouter: Record<string, { handler: unknown; method: string }>[] = [defaultRoutes];

const includeTestRoutes =
  getEnv('ENABLE_TEST_ROUTES') === 'true' ||
  isTest() ||
  getEnv('VITEST') === 'true' ||
  getEnv('NODE_ENV') === 'test';

if (includeTestRoutes) {
  httpRouter.push(testRoutes);
}

type HttpRouter = typeof httpRouter;

export type { HttpRouter };
export { httpRouter };
