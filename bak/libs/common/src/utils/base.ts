import { logger } from '../logger';

const checks = (
  checksArr: Array<{
    error?: Error | string;
    message?: string;
    property: (() => boolean) | boolean;
  }>
): { message?: string; valid: boolean } => {
  let valid = true;
  let message = 'All checks passed';
  for (const check of checksArr) {
    // Force a boolean conversion
    const result = Boolean(
      typeof check.property === 'function' ? check.property() : check.property
    );
    if (result === true) {
      valid = false;
      message = check.message || 'Check failed';
      if (check.error instanceof Error) {
        throw check.error;
      }
      break;
    }
  }
  return { message, valid };
};

const exit = ({
  code = 1,
  message = '',
}: {
  code?: number;
  message?: string;
}) => {
  if (message) {
    logger.error(message);
  }
  process.exit(code);
};

export { checks, exit };
