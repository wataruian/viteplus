import { commonEnvSchema, isTrue, validateEnv } from '@lightproject/common/environment';
import { z } from 'zod';

const schema = commonEnvSchema.extend({
  VITE_API_URL: z.string().optional(),
  VITE_ENABLE_TEST_ROUTES: z.enum(['true', 'false']).optional(),
});

const env = validateEnv(schema);

const config = {
  get viteApiUrl() {
    return env.VITE_API_URL;
  },
  get viteEnableTestRoutes() {
    return isTrue(env.VITE_ENABLE_TEST_ROUTES);
  },
};

export { config };
