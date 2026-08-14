import { adminUrl, apiBaseUrl, siteUrl } from '@lightproject/common/configs';
import type { CorsOptions } from 'cors';

import { config } from '../config';

const allowedOrigins: string[] = [];

if (apiBaseUrl) {
  allowedOrigins.push(apiBaseUrl);
}

if (adminUrl) {
  allowedOrigins.push(adminUrl);
}

if (siteUrl) {
  allowedOrigins.push(siteUrl);
}

const additionalOrigins = config.additionalCorsOrigins;
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
