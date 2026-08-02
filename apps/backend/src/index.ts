import { initializeTelemetry } from '@lightproject/common/utils';
import packageJson from '../package.json' with { type: 'json' };

const bootstrap = () => {
  initializeTelemetry({
    serviceName: packageJson.name,
    serviceVersion: packageJson.version,
  })
    .then(async () => {
      const { startServer } = await import('./main');

      startServer().catch((error: unknown) => {
        globalThis.console.error('Failed to start server:', error);
        globalThis.process.exit(1);
      });
    })
    .catch((error: unknown) => {
      globalThis.console.error('Failed to bootstrap:', error);
      globalThis.process.exit(1);
    });
};

bootstrap();
