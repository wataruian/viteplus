import { appEnvOptions, readRuntimeEnv } from '@lightproject/common/environment';
import { createEnv } from '@t3-oss/env-core';

const shared = {};

const client = {};

const env = createEnv({
  ...appEnvOptions,
  client,
  runtimeEnv: readRuntimeEnv({ ...client, ...shared }),
  shared,
});

export { client, env, shared };
