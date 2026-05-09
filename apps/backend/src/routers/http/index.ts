import defaultRoutes from './routes/default';
import testRoutes from './routes/test';

const httpRouter = [defaultRoutes, testRoutes];

type HttpRouter = typeof httpRouter;

export type { HttpRouter };
export { httpRouter };
