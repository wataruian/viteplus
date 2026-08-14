import { commonEnvSchema, getEnv, isTrue, validateEnv } from '@lightproject/common/environment';
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

const env = validateEnv(schema);

const config = {
  get additionalCorsOrigins() {
    return getEnv('ADDITIONAL_CORS_ORIGINS') ?? env.ADDITIONAL_CORS_ORIGINS;
  },
  get allowAllIps() {
    return isTrue(getEnv('ALLOW_ALL_IPS') ?? env.ALLOW_ALL_IPS);
  },
  get allowedIps() {
    return getEnv('ALLOWED_IPS') ?? env.ALLOWED_IPS;
  },
  get apiPort() {
    const port = getEnv('API_PORT') ?? env.API_PORT;
    return port !== undefined && port !== '' ? Math.trunc(Number(port)) : undefined;
  },
  get autogenDebug() {
    return isTrue(getEnv('AUTOGEN_DEBUG') ?? env.AUTOGEN_DEBUG);
  },
  get blockAllIps() {
    return isTrue(getEnv('BLOCK_ALL_IPS') ?? env.BLOCK_ALL_IPS);
  },
  get enableErrorStack() {
    return isTrue(getEnv('ENABLE_ERROR_STACK') ?? env.ENABLE_ERROR_STACK);
  },
  get enableTestRoutes() {
    return isTrue(getEnv('ENABLE_TEST_ROUTES') ?? env.ENABLE_TEST_ROUTES);
  },
  get skipAutogen() {
    return isTrue(getEnv('SKIP_AUTOGEN') ?? env.SKIP_AUTOGEN);
  },
  get skipOpenTelemetry() {
    return isTrue(getEnv('SKIP_OPENTELEMETRY') ?? env.SKIP_OPENTELEMETRY);
  },
};

export { config };
