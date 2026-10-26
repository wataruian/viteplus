import { type SQLWrapper, and, asc, eq, inArray, lt, lte, sql } from 'drizzle-orm';

import type {
  ClaimWorkerJob,
  HeldWorkerJob,
  PurgeWorkerJobs,
  WorkerJobQueue,
} from '../repositories/types';
import { dedupeKeyPredicate, finishedJobsPredicate, first } from '../shared';
import type { D1Database } from './client';
import { dbTime } from './clock';
import { workerJobs } from './schema';

type DueJobs = Pick<ClaimWorkerJob, 'functionName' | 'now'>;

const selectExpiredLease = (db: D1Database, { functionName, now }: DueJobs) =>
  db
    .select({ id: workerJobs.id })
    .from(workerJobs)
    .where(
      and(
        eq(workerJobs.functionName, functionName),
        eq(workerJobs.status, 'running'),
        lte(workerJobs.leaseExpiresAt, dbTime(now)),
      ),
    )
    .orderBy(asc(workerJobs.leaseExpiresAt))
    .limit(1);

const selectDuePending = (db: D1Database, { functionName, now }: DueJobs) =>
  db
    .select({ id: workerJobs.id })
    .from(workerJobs)
    .where(
      and(
        eq(workerJobs.functionName, functionName),
        eq(workerJobs.status, 'pending'),
        lte(workerJobs.runAt, dbTime(now)),
      ),
    )
    .orderBy(asc(workerJobs.runAt))
    .limit(1);

const selectExpiredJobs = (db: D1Database, { limit, status, updatedBefore }: PurgeWorkerJobs) =>
  db
    .select({ id: workerJobs.id })
    .from(workerJobs)
    .where(
      and(
        sql.raw(finishedJobsPredicate),
        eq(workerJobs.status, status),
        lt(workerJobs.updatedAt, updatedBefore),
      ),
    )
    .orderBy(asc(workerJobs.updatedAt))
    .limit(limit);

const whenDead = (revived: SQLWrapper, current: SQLWrapper) =>
  sql`CASE WHEN ${workerJobs.status} = 'dead' THEN ${revived} ELSE ${current} END`;

const heldBy = ({ attempt, id, leaseOwner }: HeldWorkerJob) =>
  and(
    eq(workerJobs.id, id),
    eq(workerJobs.status, 'running'),
    eq(workerJobs.leaseOwner, leaseOwner),
    eq(workerJobs.attempts, attempt),
  );

const createD1WorkerJobQueue = (db: D1Database): WorkerJobQueue => ({
  claim: async ({ functionName, leaseMs, leaseOwner, now }) => {
    const claimFirst = async (select: typeof selectDuePending) =>
      first(
        await db
          .update(workerJobs)
          .set({
            attempts: sql`${workerJobs.attempts} + 1`,
            leaseExpiresAt: dbTime(now, leaseMs),
            leaseOwner,
            status: 'running',
            updatedAt: dbTime(now),
          })
          .where(eq(workerJobs.id, select(db, { functionName, now })))
          .returning(),
      );
    return (await claimFirst(selectExpiredLease)) ?? (await claimFirst(selectDuePending));
  },
  complete: async (held) => {
    const rows = await db
      .update(workerJobs)
      .set({
        leaseExpiresAt: null,
        leaseOwner: null,
        status: 'succeeded',
        updatedAt: dbTime(held.now),
      })
      .where(heldBy(held))
      .returning({ id: workerJobs.id });
    return rows.length > 0;
  },
  enqueue: async (job) => {
    const [row] = await db
      .insert(workerJobs)
      .values(job)
      .onConflictDoUpdate({
        set: {
          attempts: whenDead(sql`0`, workerJobs.attempts),
          lastError: whenDead(sql`NULL`, workerJobs.lastError),
          maxAttempts: whenDead(sql.raw('excluded.max_attempts'), workerJobs.maxAttempts),
          payload: whenDead(sql.raw('excluded.payload'), workerJobs.payload),
          runAt: whenDead(sql.raw('excluded.run_at'), workerJobs.runAt),
          status: whenDead(sql`'pending'`, workerJobs.status),
          updatedAt: whenDead(sql.raw('excluded.updated_at'), workerJobs.updatedAt),
        },
        target: [workerJobs.functionName, workerJobs.dedupeKey],
        targetWhere: sql.raw(dedupeKeyPredicate),
      })
      .returning();
    return row;
  },
  fail: async ({ lastError, retryAfterMs, ...held }) => {
    const rows = await db
      .update(workerJobs)
      .set({
        lastError,
        leaseExpiresAt: null,
        leaseOwner: null,
        updatedAt: dbTime(held.now),
        ...(retryAfterMs === undefined
          ? { status: 'dead' as const }
          : { runAt: dbTime(held.now, retryAfterMs), status: 'pending' as const }),
      })
      .where(heldBy(held))
      .returning({ id: workerJobs.id });
    return rows.length > 0;
  },
  heartbeat: async ({ leaseMs, ...held }) => {
    const rows = await db
      .update(workerJobs)
      .set({ leaseExpiresAt: dbTime(held.now, leaseMs), updatedAt: dbTime(held.now) })
      .where(heldBy(held))
      .returning({ id: workerJobs.id });
    return rows.length > 0;
  },
  purge: async ({ limit, status, updatedBefore }) => {
    const rows = await db
      .delete(workerJobs)
      .where(inArray(workerJobs.id, selectExpiredJobs(db, { limit, status, updatedBefore })))
      .returning({ id: workerJobs.id });
    return rows.length;
  },
  release: async (held) => {
    const rows = await db
      .update(workerJobs)
      .set({
        attempts: sql`${workerJobs.attempts} - 1`,
        leaseExpiresAt: null,
        leaseOwner: null,
        runAt: dbTime(held.now),
        status: 'pending',
        updatedAt: dbTime(held.now),
      })
      .where(heldBy(held))
      .returning({ id: workerJobs.id });
    return rows.length > 0;
  },
});

export {
  createD1WorkerJobQueue,
  heldBy,
  selectDuePending,
  selectExpiredJobs,
  selectExpiredLease,
  whenDead,
};
export type { DueJobs };
