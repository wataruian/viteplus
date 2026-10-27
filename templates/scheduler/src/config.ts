import { env } from './env';

const config = {
  get skipOpenTelemetry() {
    return env.SKIP_OPENTELEMETRY;
  },
};

export { config };
