import type { DatabaseDialect } from '../environment/dialect';
import type { JobStatus } from '../shared';
import type { NewScriptLock, NewUser, NewWorkerJob, ScriptLock, User, WorkerJob } from '../types';
import type { Direction, Filters, TableRepository, Where } from './table';

interface Tables {
  scriptLocks: TableRepository<ScriptLock, NewScriptLock>;
  users: TableRepository<User, NewUser>;
  workerJobs: TableRepository<WorkerJob, NewWorkerJob>;
}

interface ListUsers {
  limit: number;
  offset?: number | undefined;
  order?: Direction | undefined;
}

interface FindUsers extends ListUsers {
  where: Where<User>;
}

interface SearchUsers extends ListUsers {
  where: Filters<User>;
}

interface CountUsers {
  where?: Filters<User> | undefined;
}

type UserChanges = Partial<Omit<NewUser, 'createdAt' | 'id' | 'updatedAt'>>;

interface RemoveUsers {
  where: Where<User>;
}

interface UpdateUsers extends RemoveUsers {
  changes: UserChanges;
}

interface UsersRepository {
  count: (options?: CountUsers) => Promise<number>;
  findByEmail: (email: string) => Promise<User | undefined>;
  findById: (id: string) => Promise<User | undefined>;
  findMany: (options: FindUsers) => Promise<User[]>;
  insert: (user: NewUser) => Promise<User>;
  insertMany: (users: readonly NewUser[]) => Promise<User[]>;
  list: (options: ListUsers) => Promise<User[]>;
  remove: (id: string) => Promise<boolean>;
  removeMany: (options: RemoveUsers) => Promise<number>;
  search: (options: SearchUsers) => Promise<User[]>;
  update: (id: string, changes: UserChanges) => Promise<User | undefined>;
  updateMany: (options: UpdateUsers) => Promise<User[]>;
  upsert: (user: NewUser) => Promise<User>;
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

interface AcquireScriptLock {
  name: string;
  owner: string;
  leaseMs: number;
  now?: Date | undefined;
}

interface HeldScriptLock {
  name: string;
  owner: string;
}

interface RenewScriptLock extends HeldScriptLock {
  leaseMs: number;
  now?: Date | undefined;
}

interface ScriptLockStore {
  acquire: (lock: AcquireScriptLock) => Promise<boolean>;
  release: (held: HeldScriptLock) => Promise<boolean>;
  renew: (renew: RenewScriptLock) => Promise<boolean>;
}

interface ScriptLocksRepository extends ScriptLockStore {
  findByName: (name: string) => Promise<ScriptLock | undefined>;
}

interface Database {
  close: () => Promise<void>;
  dialect: DatabaseDialect;
  scriptLocks: ScriptLocksRepository;
  users: UsersRepository;
  workerJobs: WorkerJobsRepository;
}

export type {
  Direction,
  Filters,
  Operators,
  OrderBy,
  Page,
  TableRepository,
  Upsert,
  Where,
} from './table';

export type {
  AcquireScriptLock,
  ClaimWorkerJob,
  CountUsers,
  Database,
  FailWorkerJob,
  FindUsers,
  FinishedJobStatus,
  HeldScriptLock,
  HeldWorkerJob,
  ListUsers,
  PurgeWorkerJobs,
  RemoveUsers,
  RenewScriptLock,
  RenewWorkerJob,
  ScriptLocksRepository,
  ScriptLockStore,
  SearchUsers,
  Tables,
  UpdateUsers,
  UserChanges,
  UsersRepository,
  WorkerJobQueue,
  WorkerJobsRepository,
};
