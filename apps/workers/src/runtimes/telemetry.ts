import { logger } from '@lightproject/common/logger';
import { initializeContextPropagation, initializeTelemetry } from '@lightproject/common/server';

import packageJson from '../../package.json' with { type: 'json' };
import { config } from '../config';

let started: Promise<void> | undefined = undefined;

const initialize = async () => {
  if (config.skipOpenTelemetry) {
    initializeContextPropagation();
  } else {
    await initializeTelemetry({
      serviceName: packageJson.name,
      serviceVersion: packageJson.version,
    });
  }
};

const startTelemetry = async () => {
  started ??= initialize().catch((error: unknown) => {
    logger.error('Telemetry setup failed; continuing without it', { error });
  });
  await started;
};

export { initialize, startTelemetry };
