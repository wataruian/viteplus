import {
  strictFlag as flag,
  readRuntimeEnv,
  serverEnvOptions,
} from '@lightproject/common/environment';
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const server = {
  ADDITIONAL_CORS_ORIGINS: z.string().optional(),
  ALLOWED_IPS: z.string().optional(),
  ALLOW_ALL_IPS: flag.default(false),
  BACKEND_PORT: z.coerce.number().int().positive().optional(),
  BACKEND_URL: z.url().optional(),
  BLOCK_ALL_IPS: flag.default(false),
  ENABLE_ERROR_STACK: flag.optional(),
  SKIP_OPENTELEMETRY: flag.default(false),
  TRUSTED_PROXIES: z.string().optional(),
};

const env = createEnv({
  ...serverEnvOptions,
  isServer: true,
  runtimeEnv: readRuntimeEnv(server),
  server,
});

export { env, server };
