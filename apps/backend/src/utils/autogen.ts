import { build } from './autogen';
import { logger } from '@lightproject/common/logger';

if (import.meta.url === `file://${globalThis.process.argv[1]}`) {
  try {
    await build();
  } catch (error) {
    logger.error('Error in autogen script:', error as Record<string, unknown>);
    globalThis.process.exit(1);
  }
}

export * from './autogen/index';
