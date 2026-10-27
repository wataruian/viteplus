import { type Context, context } from '../utils/telemetry';
import { type Logger, logger } from './log';

type LevelLogger = Pick<Logger, 'debug' | 'error' | 'info' | 'warn'>;

const bindLogger = (active: Context): LevelLogger => {
  const at =
    (level: keyof LevelLogger): LevelLogger[keyof LevelLogger] =>
    (message, metadata) => {
      context.with(active, () => {
        logger[level](message, metadata);
      });
    };
  return { debug: at('debug'), error: at('error'), info: at('info'), warn: at('warn') };
};

export { bindLogger };
export type { LevelLogger };
