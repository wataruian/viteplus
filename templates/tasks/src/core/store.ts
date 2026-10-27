import type { repositories } from '@lightproject/datastore';

import type { Job, NewJob } from './job';

type Clock = () => number;

type FinishedStatus = repositories.FinishedJobStatus;

interface JobStore extends Omit<repositories.WorkerJobQueue, 'enqueue'> {
  enqueue: (job: NewJob) => Promise<Job>;
  findById: (id: string) => Promise<Job | undefined>;
  close: () => Promise<void>;
}

export type { Clock, FinishedStatus, JobStore };
