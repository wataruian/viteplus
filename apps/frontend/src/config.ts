import { apiBaseUrl } from '@lightproject/common/configs';
import { commonEnvSchema, validateEnv } from '@lightproject/common/environment';
import { z } from 'zod';

const schema = commonEnvSchema.extend({
  ADMIN_PORT: z.string().optional(),
  API_URL: z.string().optional(),
  TEST_VAR: z.string().optional(),
  VITE_ADMIN_PORT: z.string().optional(),
  VITE_API_URL: z.string().optional(),
  VITE_TEST_VAR: z.string().optional(),
});

const { get } = validateEnv(schema);

const config = {
  get adminPort() {
    const port = get('ADMIN_PORT') ?? get('VITE_ADMIN_PORT');
    return port !== undefined && port !== '' ? Math.trunc(Number(port)) : 3001;
  },
  get viteApiUrl() {
    const url = get('API_URL') ?? get('VITE_API_URL');
    return url !== undefined && url !== '' ? url : apiBaseUrl;
  },
  get viteTestVar() {
    return get('TEST_VAR') ?? get('VITE_TEST_VAR') ?? undefined;
  },
};

export { config, get };
