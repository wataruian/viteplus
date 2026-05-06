import { logger } from '@lightproject/common/logger';

import { build } from './autogen/index';

// Main execution when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      await build();
    } catch (error) {
      logger.error('Error in autogen script:', error);
      process.exit(1);
    }
  })().catch(error => {
    logger.error('Unhandled error in autogen:', error);
    process.exit(1);
  });
}

// Re-export everything from the modular autogen system
export * from './autogen/index';
