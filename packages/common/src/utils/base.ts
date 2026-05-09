import { logger } from '../logger';

const checks = (
  checksArr: {
    error?: Error | string;
    message?: string;
    property: (() => boolean) | boolean;
  }[],
): { message?: string; valid: boolean } => {
  let valid = true;
  let message = 'All checks passed';
  for (const check of checksArr) {
    const result = typeof check.property === 'function' ? check.property() : check.property;
    if (result) {
      valid = false;
      message = check.message ?? 'Check failed';
      if (check.error instanceof Error) {
        throw check.error;
      }
      break;
    }
  }
  return { message, valid };
};

const exit = ({ code = 1, message = '' }: { code?: number; message?: string }) => {
  if (message) {
    logger.error(message);
  }
  globalThis.process.exit(code);
};

export { checks, exit };
