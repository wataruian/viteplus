import { type SQL, sql } from 'drizzle-orm';

const dbTime = (now: Date | undefined, plusMs = 0): Date | SQL =>
  now === undefined
    ? sql`(now() + ${plusMs}::integer * interval '1 millisecond')`
    : new Date(now.getTime() + plusMs);

export { dbTime };
