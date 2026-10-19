import { defineConfig } from 'drizzle-kit';

const { env } = globalThis.process;

const localDefault = 'lightproject';
const localUrl = `postgres://${encodeURIComponent(env['POSTGRES_USER'] ?? localDefault)}:${encodeURIComponent(env['POSTGRES_PASSWORD'] ?? localDefault)}@${env['POSTGRES_HOST'] ?? 'localhost'}:${env['POSTGRES_PORT'] ?? '5432'}/${env['POSTGRES_DB'] ?? localDefault}`;

export { env, localDefault, localUrl };

export default defineConfig({
  dbCredentials: {
    url: env['POSTGRES_URL'] ?? localUrl,
  },
  dialect: 'postgresql',
  out: './migrations/postgres',
  schema: './src/postgres/schema.ts',
});
