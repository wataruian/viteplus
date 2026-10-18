import { eq, sql } from 'drizzle-orm';

import * as d1 from '../../src/d1';
import * as postgres from '../../src/postgres';
import type { ContractTarget } from './database-contract';

const first = <T>(rows: T[]) => rows.at(0);

const required = <T>(row: T | undefined) => {
  if (row === undefined) {
    throw new Error('expected a row');
  }
  return row;
};

const createPostgresTarget = ({
  close,
  db,
}: ReturnType<typeof postgres.createPostgresDatabase>): ContractTarget => ({
  close,
  findJob: async (id) =>
    first(await db.select().from(postgres.workerJobs).where(eq(postgres.workerJobs.id, id))),
  findUser: async (id) =>
    first(await db.select().from(postgres.users).where(eq(postgres.users.id, id))),
  insertJob: async (job) =>
    required(first(await db.insert(postgres.workerJobs).values(job).returning())),
  insertJobWithRawStatus: async (job, status) => {
    await db.execute(sql`
      INSERT INTO worker_jobs (id, function_name, payload, status, max_attempts, run_at, created_at, updated_at)
      VALUES (${job.id}, ${job.functionName}, '{}'::jsonb, ${status}, 1, now(), now(), now())`);
  },
  insertUser: async (user) =>
    required(first(await db.insert(postgres.users).values(user).returning())),
  renameUser: async (id, name) =>
    first(
      await db.update(postgres.users).set({ name }).where(eq(postgres.users.id, id)).returning(),
    ),
});

const createD1Target = (db: d1.D1Database, close: () => Promise<void>): ContractTarget => ({
  close,
  findJob: async (id) =>
    await db.select().from(d1.workerJobs).where(eq(d1.workerJobs.id, id)).get(),
  findUser: async (id) => await db.select().from(d1.users).where(eq(d1.users.id, id)).get(),
  insertJob: async (job) => required(await db.insert(d1.workerJobs).values(job).returning().get()),
  insertJobWithRawStatus: async (job, status) => {
    await db.run(sql`
      INSERT INTO worker_jobs (id, function_name, payload, status, max_attempts, run_at, created_at, updated_at)
      VALUES (${job.id}, ${job.functionName}, '{}', ${status}, 1, 0, 0, 0)`);
  },
  insertUser: async (user) => required(await db.insert(d1.users).values(user).returning().get()),
  renameUser: async (id, name) =>
    await db.update(d1.users).set({ name }).where(eq(d1.users.id, id)).returning().get(),
});

export { createD1Target, createPostgresTarget };
