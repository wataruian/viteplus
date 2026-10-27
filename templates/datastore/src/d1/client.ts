import type { D1Database as D1Binding } from '@cloudflare/workers-types/index.ts';
import { drizzle } from 'drizzle-orm/d1';

const createD1Database = (binding: D1Binding) => drizzle(binding);

type D1Database = ReturnType<typeof createD1Database>;

export type { D1Database as D1Binding } from '@cloudflare/workers-types/index.ts';

export { createD1Database };
export type { D1Database };
