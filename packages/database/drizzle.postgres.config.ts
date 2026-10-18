import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dbCredentials: {
    url:
      globalThis.process.env['POSTGRES_URL'] ??
      'postgres://lightproject:lightproject@localhost:5432/lightproject',
  },
  dialect: 'postgresql',
  out: './migrations/postgres',
  schema: './src/postgres/schema.ts',
});
