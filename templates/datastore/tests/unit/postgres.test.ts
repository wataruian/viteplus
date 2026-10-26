import { describeDatabase } from '../shared/database-contract';
import { startPglite } from '../shared/local-postgres';
import { createPostgresTarget } from '../shared/targets';

describeDatabase('postgres (PGlite)', async () => createPostgresTarget(await startPglite()));
