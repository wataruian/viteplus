import { appEnvOptions, readRuntimeEnv } from '@lightproject/common/environment';
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const shared = {
  FRONTEND_PORT: z.coerce.number().int().positive().optional(),
};

const client = {};

const env = createEnv({
  ...appEnvOptions,
  client,
  runtimeEnv: readRuntimeEnv({ ...client, ...shared }),
  shared,
});

export { env };
