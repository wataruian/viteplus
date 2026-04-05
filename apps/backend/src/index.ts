import { environment, logger, samples } from '@lightproject/common';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

const SERVER_PORT = 3000;

export const app: express.Application = express();

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
  res.json({ message: samples.hello.greet(), metadata });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

if (!environment.env.isLocal()) {
  const port = globalThis.process.env['PORT'] ?? SERVER_PORT.toString();
  app.listen(port);
  logger.info(`Server started on http://localhost:${port}`);
}
