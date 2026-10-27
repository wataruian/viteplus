import type { scriptLocks, users, workerJobs } from './postgres/schema';

type ScriptLock = typeof scriptLocks.$inferSelect;
type NewScriptLock = typeof scriptLocks.$inferInsert;
type User = typeof users.$inferSelect;
type NewUser = typeof users.$inferInsert;
type WorkerJob = typeof workerJobs.$inferSelect;
type NewWorkerJob = typeof workerJobs.$inferInsert;

export type { NewScriptLock, NewUser, NewWorkerJob, ScriptLock, User, WorkerJob };
