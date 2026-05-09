import { build } from './autogen';
import { logger } from '@lightproject/common/logger';

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      await build();
    } catch (error) {
      logger.error('Error in autogen script:', error);
      process.exit(1);
    }
  })().catch((error) => {
    logger.error('Unhandled error in autogen:', error);
    process.exit(1);
  });
}

export * from './autogen/index';
