import { logger } from '@lightproject/common/logger';
import { initializeTelemetry } from '@lightproject/common/utils';

import packageJson from '../package.json' with { type: 'json' };
import { config } from './config';

const init = async () => {
  if (config.skipOpenTelemetry) {
    logger.info('Skipping telemetry initialization when SKIP_OPENTELEMETRY is true');
  } else {
    await initializeTelemetry({
      serviceName: packageJson.name,
      serviceVersion: packageJson.version,
    });
  }

  const { startServer } = await import('./main');

  await startServer();
};

const bootstrap = () => {
  init().catch((error: unknown) => {
    logger.error('Failed to bootstrap:', { error });
    globalThis.process.exit(1);
  });
};

bootstrap();
