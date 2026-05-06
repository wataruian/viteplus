import defaultRoutes from './routes/default';
import testRoutes from './routes/test';

export const httpRouter = [defaultRoutes, testRoutes];

export type HttpRouter = typeof httpRouter;
