import { db } from '@lightproject/database';

import type { JobStore } from '../core/store';
import { createDatabaseStore } from './database';
import { createMemoryStore } from './memory';

const jobStoreKinds = ['memory', 'database'] as const;

type JobStoreKind = (typeof jobStoreKinds)[number];

const createJobStore = async (kind: JobStoreKind, env: db.DatabaseEnv = {}): Promise<JobStore> =>
  kind === 'memory' ? createMemoryStore() : createDatabaseStore(await db.createDatabase(env));

export { createJobStore, jobStoreKinds };
export type { JobStoreKind };
