import { createTelemetryStarter } from '@lightproject/common/server';

import packageJson from '../../package.json' with { type: 'json' };
import { config } from '../config';

const serviceName = packageJson.name;

const startTelemetry = createTelemetryStarter({
  serviceName,
  serviceVersion: packageJson.version,
  skip: () => config.skipOpenTelemetry,
});

export { serviceName, startTelemetry };
