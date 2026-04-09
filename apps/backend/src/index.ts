import cors from 'cors';
import express from 'express';
import { greet } from '@lightproject/common/samples';
import helmet from 'helmet';
import { isLocal } from '@lightproject/common/environment';
import { logger } from '@lightproject/common/logger';

const SERVER_PORT = 3000;

const app: express.Application = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  const metadata = {
    env: globalThis.process.env['ENV'],
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

if (!isLocal()) {
  const port = globalThis.process.env['PORT'] ?? SERVER_PORT.toString();
  app.listen(port);
  logger.info(`Server started on http://localhost:${port}`);
}
