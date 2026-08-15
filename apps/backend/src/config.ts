import { commonEnvSchema, isTrue, validateEnv } from '@lightproject/common/environment';
import { z } from 'zod';

const schema = commonEnvSchema.extend({
  ADDITIONAL_CORS_ORIGINS: z.string().optional(),
  ALLOWED_IPS: z.string().optional(),
  ALLOW_ALL_IPS: z.enum(['true', 'false']).optional(),
  API_PORT: z.string().regex(/^\d+$/u).optional(),
  AUTOGEN_DEBUG: z.enum(['true', 'false']).optional(),
  BLOCK_ALL_IPS: z.enum(['true', 'false']).optional(),
  ENABLE_ERROR_STACK: z.enum(['true', 'false']).optional(),
  ENABLE_TEST_ROUTES: z.enum(['true', 'false']).optional(),
  SKIP_AUTOGEN: z.enum(['true', 'false']).optional(),
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
    return port !== undefined && port !== '' ? Math.trunc(Number(port)) : undefined;
  },
  get autogenDebug() {
    return isTrue(get('AUTOGEN_DEBUG'));
  },
  get blockAllIps() {
    return isTrue(get('BLOCK_ALL_IPS'));
  },
  get enableErrorStack() {
    return isTrue(get('ENABLE_ERROR_STACK'));
  },
  get enableTestRoutes() {
    return isTrue(get('ENABLE_TEST_ROUTES'));
  },
  get skipAutogen() {
    return isTrue(get('SKIP_AUTOGEN'));
  },
  get skipOpenTelemetry() {
    return isTrue(get('SKIP_OPENTELEMETRY'));
  },
};

export { config };
