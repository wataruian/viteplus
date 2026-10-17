import { isLocal, isProduction } from '@lightproject/common/environment';

import { env } from './env';

const config = {
  get additionalCorsOrigins() {
    return env.ADDITIONAL_CORS_ORIGINS;
  },
  get allowAllIps() {
    return env.ALLOW_ALL_IPS;
  },
  get allowedIps() {
    return env.ALLOWED_IPS;
  },
  get backendPort() {
    return env.BACKEND_PORT ?? 2000;
  },
  get blockAllIps() {
    return env.BLOCK_ALL_IPS;
  },
  get enableErrorStack() {
    if (isProduction()) {
      return false;
    }
    return env.ENABLE_ERROR_STACK ?? isLocal();
  },
  get skipOpenTelemetry() {
    return env.SKIP_OPENTELEMETRY;
  },
  get trustedProxies() {
    return env.TRUSTED_PROXIES;
  },
};

export { config };
