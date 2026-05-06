import { startServer } from './main';

// void (async () => {
(() => {
  try {
    // await startServer();
    startServer();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
