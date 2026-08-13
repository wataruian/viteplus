import { getEnv, isTrue } from '@lightproject/common/environment';

const config = {
  get additionalCorsOrigins() {
    return getEnv('ADDITIONAL_CORS_ORIGINS');
  },
  get allowAllIps() {
    return isTrue(getEnv('ALLOW_ALL_IPS'));
  },
  get allowedIps() {
    return getEnv('ALLOWED_IPS');
  },
  get apiPort() {
    const port = getEnv('API_PORT');
    return port !== undefined && port !== '' ? Math.trunc(Number(port)) : undefined;
  },
  get autogenDebug() {
    return isTrue(getEnv('AUTOGEN_DEBUG'));
  },
  get blockAllIps() {
    return isTrue(getEnv('BLOCK_ALL_IPS'));
  },
  get enableErrorStack() {
    return isTrue(getEnv('ENABLE_ERROR_STACK'));
  },
  get enableTestRoutes() {
    return isTrue(getEnv('ENABLE_TEST_ROUTES'));
  },
  get skipAutogen() {
    return isTrue(getEnv('SKIP_AUTOGEN'));
  },
  get skipOpenTelemetry() {
    return isTrue(getEnv('SKIP_OPENTELEMETRY'));
  },
};

export { config };
