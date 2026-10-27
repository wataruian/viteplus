import type { repositories } from '@lightproject/datastore';

import type { JobStore } from '../core/store';

const createDatabaseStore = ({ close, workerJobs }: repositories.Database): JobStore => ({
  claim: workerJobs.claim,
  close,
  complete: workerJobs.complete,
  enqueue: async (job) => await workerJobs.enqueue({ ...job, status: 'pending' }),
  fail: workerJobs.fail,
  findById: workerJobs.findById,
  heartbeat: workerJobs.heartbeat,
  purge: workerJobs.purge,
  release: workerJobs.release,
});

export { createDatabaseStore };
