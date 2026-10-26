import { type SQL, sql } from 'drizzle-orm';

const dbTime = (now: Date | undefined, plusMs = 0): Date | SQL =>
  now === undefined
    ? sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER) + ${plusMs})`
    : new Date(now.getTime() + plusMs);

export { dbTime };
