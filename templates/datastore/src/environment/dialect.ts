import { getDatabaseDialect } from './variables';

const databaseDialects = ['d1', 'postgres'] as const;

type DatabaseDialect = (typeof databaseDialects)[number];

const resolveDatabaseDialect = (value = getDatabaseDialect()): DatabaseDialect => {
  const dialect = databaseDialects.find((candidate) => candidate === value);
  if (dialect === undefined) {
    throw new Error(
      `Set DATABASE_DIALECT to one of: ${databaseDialects.join(', ')} (got '${value}')`,
    );
  }
  return dialect;
};

export { databaseDialects, resolveDatabaseDialect };
export type { DatabaseDialect };
