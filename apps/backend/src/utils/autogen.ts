import { build } from './autogen';
import fs from 'node:fs';
import { logger } from '@lightproject/common/logger';
import path from 'node:path';

const envPath = path.resolve(import.meta.dirname, '../../../../.env');

if (typeof globalThis.process.loadEnvFile === 'function' && fs.existsSync(envPath)) {
  try {
    globalThis.process.loadEnvFile(envPath);
  } catch {
    // Silently ignore loading .env file
  }
}

if (import.meta.url === `file://${globalThis.process.argv[1]}`) {
  if (globalThis.process.argv[2] === 'true') {
    globalThis.process.env['AUTOGEN_DEBUG'] = 'true';
  }

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
