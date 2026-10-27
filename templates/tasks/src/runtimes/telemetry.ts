import { createTelemetryStarter } from '@lightproject/common/server';

import packageJson from '../../package.json' with { type: 'json' };
import { config } from '../config';

const startTelemetry = createTelemetryStarter({
  serviceName: packageJson.name,
  serviceVersion: packageJson.version,
  skip: () => config.skipOpenTelemetry,
});

export { startTelemetry };
