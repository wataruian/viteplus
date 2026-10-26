import { createMemoryStore } from '../../../src/stores/memory';
import { describeJobStore } from '../helpers/job-store-contract';

describeJobStore('memory', async () => {
  await Promise.resolve();
  return createMemoryStore();
});
