import { initializeTelemetry } from '@lightproject/common/utils';
import packageJson from '../package.json' with { type: 'json' };
import { startServer } from './main';

initializeTelemetry({
  serviceName: packageJson.name,
  serviceVersion: packageJson.version,
});

const bootstrap = () => {
  startServer().catch((error: unknown) => {
    globalThis.console.error('Failed to start server:', error);
    globalThis.process.exit(1);
  });
};

bootstrap();
