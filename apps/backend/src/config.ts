import {
  commonEnvSchema,
  isLocal,
  isProduction,
  isTrue,
  validateEnv,
} from '@lightproject/common/environment';
import { z } from 'zod';

const schema = commonEnvSchema.extend({
  ADDITIONAL_CORS_ORIGINS: z.string().optional(),
  ALLOWED_IPS: z.string().optional(),
  ALLOW_ALL_IPS: z.enum(['true', 'false']).optional(),
  API_PORT: z.string().regex(/^\d+$/u).optional(),
  BLOCK_ALL_IPS: z.enum(['true', 'false']).optional(),
  ENABLE_ERROR_STACK: z.enum(['true', 'false']).optional(),
  SKIP_OPENTELEMETRY: z.enum(['true', 'false']).optional(),
});

const { get } = validateEnv(schema);

const config = {
  get additionalCorsOrigins() {
    return get('ADDITIONAL_CORS_ORIGINS');
  },
  get allowAllIps() {
    return isTrue(get('ALLOW_ALL_IPS'));
  },
  get allowedIps() {
    return get('ALLOWED_IPS');
  },
  get apiPort() {
    const port = get('API_PORT');
    return port !== undefined && port !== '' ? Math.trunc(Number(port)) : 3000;
  },
  get blockAllIps() {
    return isTrue(get('BLOCK_ALL_IPS'));
  },
  get enableErrorStack() {
    if (isProduction()) {
      return false;
    }
    const raw = get('ENABLE_ERROR_STACK');
    if (raw !== undefined && raw !== '') {
      return isTrue(raw);
    }
    return isLocal();
  },
  get skipOpenTelemetry() {
    return isTrue(get('SKIP_OPENTELEMETRY'));
  },
};

export { config, get };
