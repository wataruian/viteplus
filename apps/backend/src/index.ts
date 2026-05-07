import { getEnv, getEnvironmentMode, isLocal } from '@lightproject/common/environment';
import cors from 'cors';
import { corsOptions } from './utils/cors';
import express from 'express';
import { greet } from '@lightproject/common/samples';
import helmet from 'helmet';
import { logger } from '@lightproject/common/logger';

const env = getEnvironmentMode();
const useViteBackend = (getEnv('USE_VITE_BACKEND') ?? 'false').toLowerCase() === 'true';
const port = Number.parseInt(getEnv('API_PORT') ?? '3000', 10);
const app: express.Application = express();

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(corsOptions));

app.get('/', (_req, res) => {
  const metadata = {
    env,
    password: 'password',
    safe: 'safe',
  };
  logger.info('Accessing root endpoint', metadata);
  res.json({ message: greet(), metadata });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// app.use(initializeRequest as ExpressRequestHandler);
// app.use(gatewayMiddleware as ExpressRequestHandler);

// app.set('trust proxy', true);
// app.use(trustProxyMiddleware);

// // app.use(cspMiddleware);

// registerHttpRoutes(app, endpoints.apiEndpoint);
// registerTrpcRoutes(app, endpoints.trpcEndpoint);

// if (isLocal()) {
//   trpcPlayground(app).catch((error) => {
//     logger.error('Failed to initialize tRPC Playground:', error);
//   });
//   logger.info(`🧪 tRPC Playground: ${endpoints.trpcPlaygroundUrl}`);
//   swaggerOpenApiMiddleware(app);
//   logger.info(`📚 Swagger UI: ${endpoints.docsUrl}`);
// }

// app.use(notFoundHandler);

// app.use(errorHandler as unknown as ExpressRequestHandler);

if (!useViteBackend || !isLocal()) {
  app.listen(port);
  logger.info(`Server started on http://localhost:${port}`);
}

export { app };
