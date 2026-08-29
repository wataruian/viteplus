import { commonEnvSchema, validateEnv } from '@lightproject/common/environment';
import { z } from 'zod';

const schema = commonEnvSchema.extend({
  ADMIN_PORT: z.string().optional(),
  VITE_ADMIN_PORT: z.string().optional(),
  VITE_API_URL: z.string().optional(),
});

const { get } = validateEnv(schema);

const config = {
  get adminPort() {
    const port = get('ADMIN_PORT') ?? get('VITE_ADMIN_PORT');
    return port !== undefined && port !== '' ? Math.trunc(Number(port)) : 3001;
  },
  get viteApiUrl() {
    return get('VITE_API_URL');
  },
};

export { config };
