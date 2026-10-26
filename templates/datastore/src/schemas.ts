import { createSelectSchema } from 'drizzle-orm/zod';

import { users, workerJobs } from './postgres/schema';

const user = createSelectSchema(users);
const workerJob = createSelectSchema(workerJobs);

export { user, workerJob };
