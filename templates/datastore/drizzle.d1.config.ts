import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  out: './migrations/d1',
  schema: './src/d1/schema.ts',
});
