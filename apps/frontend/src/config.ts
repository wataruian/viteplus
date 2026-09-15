import { apiBaseUrl, trpcEndpoint } from '@lightproject/common/configs';
import { commonEnvSchema, validateEnv } from '@lightproject/common/environment';
import { z } from 'zod';

const schema = commonEnvSchema.extend({
  ADMIN_PORT: z.string().optional(),
  API_URL: z.string().optional(),
  VITE_ADMIN_PORT: z.string().optional(),
  VITE_API_URL: z.string().optional(),
});

const { get: baseGet } = validateEnv(schema);

const getViteEnv = (key: string): string | undefined => {
  const value: unknown = import.meta.env[key];
  return typeof value === 'string' ? value : undefined;
};

const get = (key: Parameters<typeof baseGet>[0]): string | undefined =>
  baseGet(key) ?? getViteEnv(key);

const config = {
  get adminPort() {
    const port = get('ADMIN_PORT') ?? get('VITE_ADMIN_PORT');
    return port !== undefined && port !== '' ? Math.trunc(Number(port)) : 3001;
  },
  get trpcUrl() {
    return this.viteApiUrl + trpcEndpoint;
  },
  get viteApiUrl() {
    const url = get('API_URL') ?? get('VITE_API_URL');
    return url !== undefined && url !== '' ? url : apiBaseUrl;
  },
};

export { config, get, getViteEnv };
