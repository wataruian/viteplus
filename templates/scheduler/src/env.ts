import {
  strictFlag as flag,
  readRuntimeEnv,
  serverEnvOptions,
} from '@lightproject/common/environment';
import { createEnv } from '@t3-oss/env-core';

const server = {
  SKIP_OPENTELEMETRY: flag.default(false),
};

const env = createEnv({
  ...serverEnvOptions,
  isServer: true,
  runtimeEnv: readRuntimeEnv(server),
  server,
});

export { env, server };
