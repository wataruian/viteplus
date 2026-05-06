import { endpoints } from '@lightproject/common/configs';
import type { CorsOptions } from 'cors';

const allowedOrigins = [
  endpoints.apiUrl,
  endpoints.siteUrl,
  'http://localhost:3000',
  'http://localhost:3001',
];

if (process.env['SITE_URL']) {
  allowedOrigins.push(process.env['SITE_URL']);
}

const corsOptions: CorsOptions = {
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Accept',
    'Authorization',
    'Content-Type',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  origin: allowedOrigins,
};

export { allowedOrigins, corsOptions };
