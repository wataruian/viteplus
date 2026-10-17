import { backendBaseUrl } from '@lightproject/common/configs';
import { commonEnvSchema, validateEnv } from '@lightproject/common/environment';
import { z } from 'zod';

const schema = commonEnvSchema.extend({
  BACKEND_URL: z.string().optional(),
  FRONTEND_PORT: z.string().optional(),
});

const { get } = validateEnv(schema);

const config = {
  get backendUrl() {
    const url = get('BACKEND_URL');
    return url !== undefined && url !== '' ? url : backendBaseUrl;
  },
  get frontendPort() {
    const port = get('FRONTEND_PORT');
    return port !== undefined && port !== '' ? Math.trunc(Number(port)) : 2001;
  },
};

export { config, get };
