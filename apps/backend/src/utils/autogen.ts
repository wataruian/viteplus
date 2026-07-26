import { build } from './autogen';
import { logger } from '@lightproject/common/logger';

if (import.meta.url === `file://${globalThis.process.argv[1]}`) {
  globalThis.setTimeout(() => {
    build().catch((error: unknown) => {
      logger.error(
        'Error in autogen script:',
        error instanceof Error ? { message: error.message, stack: error.stack } : { error },
      );
      globalThis.process.exit(1);
    });
  }, 0);
}

export * from './autogen/index';
