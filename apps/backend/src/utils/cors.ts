import { adminUrl, apiBaseUrl, siteUrl } from '@lightproject/common/configs';
import { getEnv } from '@lightproject/common/environment';
import type { CorsOptions } from 'cors';

const allowedOrigins: string[] = [];

if (apiBaseUrl !== undefined) {
  allowedOrigins.push(apiBaseUrl);
}

if (adminUrl !== undefined) {
  allowedOrigins.push(adminUrl);
}

if (siteUrl !== undefined) {
  allowedOrigins.push(siteUrl);
}

const additionalOrigins = getEnv('ADDITIONAL_CORS_ORIGINS');
if (additionalOrigins !== undefined && additionalOrigins !== '') {
  const origins = additionalOrigins.split(',');
  if (origins.length > 0) {
    allowedOrigins.push(...origins);
  }
}

const uniqueOrigins = [...new Set(allowedOrigins)];

const corsOptions: CorsOptions = {
  allowedHeaders: ['Origin', 'X-Requested-With', 'Accept', 'Authorization', 'Content-Type'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  origin: uniqueOrigins,
};

export { allowedOrigins, corsOptions, uniqueOrigins };
