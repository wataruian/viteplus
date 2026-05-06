import { logger } from '@lightproject/common/logger';
import cors from 'cors';
import express from 'express';

import apiRoutes from './routes/api';

const HTTP_OK = 200;
const DEFAULT_PORT = 3000;
const app = express();
const port = process.env['PORT'] || DEFAULT_PORT;

app.use(express.json());

app.use(cors());

app.get('/', (_req: express.Request, res: express.Response) => {
  res.status(HTTP_OK).json({
    message: 'Welcome to the API',
    status: 'ok',
  });
});

app.use('/api', apiRoutes);

if (new URL(import.meta.url).pathname === process.argv[1]) {
  app.listen(port, () => {
    logger.info(`Server running on port http://localhost:${port}`);
  });
}

export default app;
