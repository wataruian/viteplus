import { z } from 'zod';

import { getEnv } from './env';

const commonEnvSchema = z.object({
  CI: z.string().optional(),
  ENV: z.enum(['local', 'develop', 'staging', 'production', 'test']).optional().default('local'),
  LOG_LEVEL: z.enum(['silent', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
});

const validateEnv = <T extends z.ZodType>(schema: T) => {
  const envObj: Record<string, string | undefined> = {};

  if (schema instanceof z.ZodObject) {
    const keys = Object.keys(schema.shape);
    for (const key of keys) {
      const val = getEnv(key);
      if (val !== undefined && val !== '') {
        envObj[key] = val;
      }
    }
  }

  const result = schema.safeParse(envObj);

  if (!result.success) {
    throw new Error(
      `Invalid environment variables: ${JSON.stringify(z.treeifyError(result.error), null, 2)}`,
    );
  }

  const env = result.data;

  const get = (key: keyof typeof env & string): string | undefined => {
    const val = getEnv(key);
    if (val !== undefined && val !== '') {
      return val;
    }
    const envVal = env[key];
    return typeof envVal === 'string' ? envVal : undefined;
  };

  return { env, get };
};

export { commonEnvSchema, validateEnv };
