import { db } from '@lightproject/datastore';

import { createDatabaseStore } from '../../../src/stores/database';
import { describeJobStore } from '../helpers/job-store-contract';
import { startLocalD1 } from '../helpers/local-d1';

describeJobStore('database (local D1)', async () => {
  const local = await startLocalD1();
  const database = await db.createDatabase({ DATABASE_DIALECT: 'd1', DB: local.binding });
  return createDatabaseStore({ ...database, close: local.dispose });
});
