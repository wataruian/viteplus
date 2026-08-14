import { commonEnvSchema, getEnv, isTrue, validateEnv } from '@lightproject/common/environment';
import { z } from 'zod';

const schema = commonEnvSchema.extend({
  VITE_API_URL: z.string().optional(),
  VITE_ENABLE_TEST_ROUTES: z.enum(['true', 'false']).optional(),
});

const env = validateEnv(schema);

const config = {
  get viteApiUrl() {
    return getEnv('VITE_API_URL') ?? env.VITE_API_URL;
  },
  get viteEnableTestRoutes() {
    return isTrue(getEnv('VITE_ENABLE_TEST_ROUTES') ?? env.VITE_ENABLE_TEST_ROUTES);
  },
};

export { config };
