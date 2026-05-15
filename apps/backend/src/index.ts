import { startServer } from './main';

const bootstrap = () => {
  startServer().catch((error: unknown) => {
    globalThis.console.error('Failed to start server:', error);
    globalThis.process.exit(1);
  });
};

bootstrap();
