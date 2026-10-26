import { defineConfig } from 'drizzle-kit';

import { getPostgresUrl } from './src/environment/variables';

export default defineConfig({
  dbCredentials: {
    url: getPostgresUrl(),
  },
  dialect: 'postgresql',
  out: './migrations/postgres',
  schema: './src/postgres/schema.ts',
});
