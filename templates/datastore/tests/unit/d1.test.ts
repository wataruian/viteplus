import { describeDatabase } from '../shared/database-contract';
import { startLocalD1 } from '../shared/local-d1';
import { createD1Target } from '../shared/targets';

describeDatabase('d1', async () => createD1Target(await startLocalD1()));
