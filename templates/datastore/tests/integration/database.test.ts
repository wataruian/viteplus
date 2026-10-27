import { resolveDatabaseDialect } from '../../src/environment/dialect';
import { getPostgresUrl } from '../../src/environment/variables';
import { describeDatabase } from '../shared/database-contract';
import { startLocalD1 } from '../shared/local-d1';
import { createD1Target, createPostgresTarget } from '../shared/targets';
import { startTemporaryPostgres } from './helpers/temporary-postgres';

const dialect = resolveDatabaseDialect();

describeDatabase(dialect, async () =>
  dialect === 'd1'
    ? createD1Target(await startLocalD1())
    : createPostgresTarget(await startTemporaryPostgres(getPostgresUrl())),
);
