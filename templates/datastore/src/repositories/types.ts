import type { DatabaseDialect } from '../environment/dialect';
import type { JobStatus } from '../shared';
import type { NewUser, NewWorkerJob, User, WorkerJob } from '../types';
import type { TableRepository } from './table';

interface Tables {
  users: TableRepository<User, NewUser>;
  workerJobs: TableRepository<WorkerJob, NewWorkerJob>;
}

type UserChanges = Partial<Omit<NewUser, 'createdAt' | 'id' | 'updatedAt'>>;

interface UsersRepository {
  findByEmail: (email: string) => Promise<User | undefined>;
  findById: (id: string) => Promise<User | undefined>;
  insert: (user: NewUser) => Promise<User>;
  remove: (id: string) => Promise<boolean>;
  update: (id: string, changes: UserChanges) => Promise<User | undefined>;
}

type FinishedJobStatus = Extract<JobStatus, 'dead' | 'succeeded'>;

interface ClaimWorkerJob {
  functionName: string;
  leaseOwner: string;
  leaseMs: number;
  now?: Date | undefined;
}

interface HeldWorkerJob {
  id: string;
  leaseOwner: string;
  attempt: number;
  now?: Date | undefined;
}

interface RenewWorkerJob extends HeldWorkerJob {
  leaseMs: number;
}

interface FailWorkerJob extends HeldWorkerJob {
  lastError: string;
  retryAfterMs: number | undefined;
}

interface PurgeWorkerJobs {
  limit: number;
  status: FinishedJobStatus;
  updatedBefore: Date;
}

interface WorkerJobQueue {
  claim: (claim: ClaimWorkerJob) => Promise<WorkerJob | undefined>;
  complete: (held: HeldWorkerJob) => Promise<boolean>;
  enqueue: (job: NewWorkerJob) => Promise<WorkerJob>;
  fail: (failure: FailWorkerJob) => Promise<boolean>;
  heartbeat: (renew: RenewWorkerJob) => Promise<boolean>;
  purge: (purge: PurgeWorkerJobs) => Promise<number>;
  release: (held: HeldWorkerJob) => Promise<boolean>;
}

interface WorkerJobsRepository extends WorkerJobQueue {
  findById: (id: string) => Promise<WorkerJob | undefined>;
  insert: (job: NewWorkerJob) => Promise<WorkerJob>;
}

interface Database {
  close: () => Promise<void>;
  dialect: DatabaseDialect;
  users: UsersRepository;
  workerJobs: WorkerJobsRepository;
}

export type { TableRepository } from './table';

export type {
  ClaimWorkerJob,
  Database,
  FailWorkerJob,
  FinishedJobStatus,
  HeldWorkerJob,
  PurgeWorkerJobs,
  RenewWorkerJob,
  Tables,
  UserChanges,
  UsersRepository,
  WorkerJobQueue,
  WorkerJobsRepository,
};
