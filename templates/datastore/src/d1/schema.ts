import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type * as postgres from '../postgres/schema';
import { jobStatuses, newId, now } from '../shared';

const scriptLocks = sqliteTable('script_locks', {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(now),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  name: text('name').primaryKey(),
  owner: text('owner').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(now)
    .$onUpdateFn(now),
});

const users = sqliteTable('users', {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(now),
  email: text('email').notNull().unique(),
  id: text('id').primaryKey().$defaultFn(newId),
  name: text('name').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(now)
    .$onUpdateFn(now),
});

const workerJobs = sqliteTable(
  'worker_jobs',
  {
    attempts: integer('attempts').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(now),
    dedupeKey: text('dedupe_key'),
    functionName: text('function_name').notNull(),
    id: text('id').primaryKey(),
    lastError: text('last_error'),
    leaseExpiresAt: integer('lease_expires_at', { mode: 'timestamp_ms' }),
    leaseOwner: text('lease_owner'),
    maxAttempts: integer('max_attempts').notNull(),
    payload: text('payload', { mode: 'json' })
      .$type<(typeof postgres.workerJobs.payload)['_']['data']>()
      .notNull(),
    runAt: integer('run_at', { mode: 'timestamp_ms' }).notNull(),
    status: text('status', { enum: jobStatuses }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(now)
      .$onUpdateFn(now),
  },
  (table) => [
    check(
      'worker_jobs_status_check',
      sql.raw("status IN ('pending', 'running', 'succeeded', 'dead')"),
    ),
    uniqueIndex('worker_jobs_dedupe_idx')
      .on(table.functionName, table.dedupeKey)
      .where(sql.raw('dedupe_key IS NOT NULL')),
    index('worker_jobs_pending_idx')
      .on(table.functionName, table.runAt)
      .where(sql.raw("status = 'pending'")),
    index('worker_jobs_running_idx')
      .on(table.functionName, table.leaseExpiresAt)
      .where(sql.raw("status = 'running'")),
    index('worker_jobs_finished_idx')
      .on(table.status, table.updatedAt)
      .where(sql.raw("status IN ('succeeded', 'dead')")),
  ],
);

export { scriptLocks, users, workerJobs };
