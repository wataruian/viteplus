import { serve } from '@hono/node-server';
import {
  docsEndpoint,
  docsHttpEndpoint,
  docsTrpcEndpoint,
  requestTypes,
} from '@lightproject/common/configs';
import { isLocal } from '@lightproject/common/environment';
import { logger } from '@lightproject/common/logger';
import { shutdownTelemetry } from '@lightproject/common/server';
import { padEmoji } from '@lightproject/common/utils';

import { getApp } from '../app';
import { config } from '../config';

const registerShutdownSignals = () => {
  const signals = ['SIGTERM', 'SIGINT', 'SIGHUP'] as const;

  for (const signal of signals) {
    if (globalThis.process.listenerCount(signal) === 0) {
      globalThis.process.once(signal, () => {
        shutdownTelemetry()
          .catch(() => {})
          .finally(() => {
            globalThis.process.exit(0);
          });
      });
    }
  }
};

const init = async () => {
  const port = config.apiPort;
  const app = await getApp();

  serve({
    fetch: app.fetch,
    port,
  });

  registerShutdownSignals();

  const baseUrl = `http://localhost:${port}`;

  logger.info(`${padEmoji('🖥️', 3)} Server is running on ${baseUrl}`);

  if (isLocal()) {
    logger.info(`${padEmoji('📖')} OpenAPI docs catalog: ${baseUrl}${docsEndpoint}`);
    logger.info(
      `${padEmoji('📖')} ${requestTypes.http} OpenAPI docs: ${baseUrl}${docsHttpEndpoint}`,
    );
    logger.info(
      `${padEmoji('📖')} ${requestTypes.trpc} OpenAPI docs: ${baseUrl}${docsTrpcEndpoint}`,
    );
  }
};

const bootstrap = () => {
  init().catch((error: unknown) => {
    logger.error('Failed to start server', { error });
    globalThis.process.exit(1);
  });
};

export { bootstrap, init, registerShutdownSignals };
