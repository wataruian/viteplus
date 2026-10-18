import type { users, workerJobs } from './postgres/schema';

type User = typeof users.$inferSelect;
type NewUser = typeof users.$inferInsert;
type WorkerJob = typeof workerJobs.$inferSelect;
type NewWorkerJob = typeof workerJobs.$inferInsert;

export type { NewUser, NewWorkerJob, User, WorkerJob };
