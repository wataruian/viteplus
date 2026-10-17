import { type StandardSchemaDictionary, type StandardSchemaV1, createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

import { getEnv, isBrowser, isTrue, vitePrefix } from './env';

const flag = z
  .string()
  .optional()
  .transform((value) => isTrue(value));

const sharedShape = {
  ADMIN_URL: z.url().optional(),
  API_URL: z.url().optional(),
  BACKEND_URL: z.url().optional(),
  CHALK_LEVEL: z.string().optional(),
  CI: flag,
  DEBUG: flag,
  ENV: z.string().toLowerCase().default('local'),
  FARO_ENDPOINT: z.url().optional(),
  FRONTEND_URL: z.url().optional(),
  LOG_FORMAT: z.enum(['json', 'pretty']).optional(),
  LOG_LEVEL: z.enum(['silent', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  OTEL_SERVICE_NAME: z.string().default('application'),
  OTLP_ENDPOINT: z.url().optional(),
  SERVICE_NAME: z.string().default('@lightproject/app'),
  SERVICE_VERSION: z.string().default('1.0.0'),
  SITE_URL: z.url().optional(),
  TELEMETRY_DEBUG: flag,
  VITEST: flag,
} satisfies StandardSchemaDictionary;

const readRuntimeEnv = (shape: object): Record<string, string | undefined> =>
  Object.fromEntries(Object.keys(shape).map((key) => [key, getEnv(key)]));

const onValidationError = (issues: readonly StandardSchemaV1.Issue[]): never => {
  const lines = issues.map((issue) => {
    const path = issue.path
      ?.map((segment) => String(typeof segment === 'object' ? segment.key : segment))
      .join('.');
    return `- ${path ?? '(root)'}: ${issue.message}`;
  });
  throw new Error(`Invalid environment variables:\n${lines.join('\n')}`);
};

const commonEnv = createEnv({
  client: {},
  clientPrefix: vitePrefix,
  emptyStringAsUndefined: true,
  isServer: !isBrowser(),
  onValidationError,
  runtimeEnv: readRuntimeEnv(sharedShape),
  server: {},
  shared: sharedShape,
});

interface ServerEnvOptions {
  emptyStringAsUndefined: true;
  onValidationError: typeof onValidationError;
}

interface AppEnvOptions extends ServerEnvOptions {
  clientPrefix: typeof vitePrefix;
}

const serverEnvOptions: ServerEnvOptions = {
  emptyStringAsUndefined: true,
  onValidationError,
};

const appEnvOptions: AppEnvOptions = {
  ...serverEnvOptions,
  clientPrefix: vitePrefix,
};

export {
  appEnvOptions,
  commonEnv,
  flag,
  onValidationError,
  readRuntimeEnv,
  serverEnvOptions,
  sharedShape,
};
export type { AppEnvOptions, ServerEnvOptions };
