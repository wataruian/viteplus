import type { shared, types } from '@lightproject/database';

type Job = types.WorkerJob;
type JobStatus = shared.JobStatus;
type JsonValue = shared.JsonValue;

type NewJob = Pick<
  Job,
  | 'createdAt'
  | 'dedupeKey'
  | 'functionName'
  | 'id'
  | 'maxAttempts'
  | 'payload'
  | 'runAt'
  | 'updatedAt'
>;

export type { Job, JobStatus, JsonValue, NewJob };
