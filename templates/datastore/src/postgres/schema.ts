import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  type JsonValue,
  dedupeKeyPredicate,
  finishedJobsPredicate,
  jobStatusList,
  jobStatuses,
  newId,
  now,
} from '../shared';

const timestampColumn = (name: string) => timestamp(name, { mode: 'date', withTimezone: true });

const timestamps = {
  createdAt: timestampColumn('created_at').notNull().$defaultFn(now),
  updatedAt: timestampColumn('updated_at').notNull().$defaultFn(now).$onUpdateFn(now),
};

const users = pgTable('users', {
  email: text('email').notNull().unique(),
  id: uuid('id').primaryKey().$defaultFn(newId),
  name: text('name').notNull(),
  ...timestamps,
});

const workerJobs = pgTable(
  'worker_jobs',
  {
    attempts: integer('attempts').notNull().default(0),
    dedupeKey: text('dedupe_key'),
    functionName: text('function_name').notNull(),
    id: text('id').primaryKey(),
    lastError: text('last_error'),
    leaseExpiresAt: timestampColumn('lease_expires_at'),
    leaseOwner: text('lease_owner'),
    maxAttempts: integer('max_attempts').notNull(),
    payload: jsonb('payload').$type<JsonValue>().notNull(),
    runAt: timestampColumn('run_at').notNull(),
    status: text('status', { enum: jobStatuses }).notNull(),
    ...timestamps,
  },
  (table) => [
    check('worker_jobs_status_check', sql.raw(`status IN (${jobStatusList})`)),
    uniqueIndex('worker_jobs_dedupe_idx')
      .on(table.functionName, table.dedupeKey)
      .where(sql.raw(dedupeKeyPredicate)),
    index('worker_jobs_pending_idx')
      .on(table.functionName, table.runAt)
      .where(sql`status = 'pending'`),
    index('worker_jobs_running_idx')
      .on(table.functionName, table.leaseExpiresAt)
      .where(sql`status = 'running'`),
    index('worker_jobs_finished_idx')
      .on(table.status, table.updatedAt)
      .where(sql.raw(finishedJobsPredicate)),
  ],
);

const scriptLocks = pgTable('script_locks', {
  expiresAt: timestampColumn('expires_at').notNull(),
  name: text('name').primaryKey(),
  owner: text('owner').notNull(),
  ...timestamps,
});

export { scriptLocks, timestampColumn, timestamps, users, workerJobs };
