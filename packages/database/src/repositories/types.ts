import type { DatabaseDialect } from '../environment/dialect';
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

interface WorkerJobsRepository {
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

export type { Database, Tables, UserChanges, UsersRepository, WorkerJobsRepository };
