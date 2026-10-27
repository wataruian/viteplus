import { logger } from '@lightproject/common/logger';
import { db, type repositories } from '@lightproject/datastore';

import type { AppBindings, ServiceContext } from './schema';

let sharedDatabase: Promise<repositories.Database> | undefined = undefined;

const hasRequestBinding = (env: AppBindings) =>
  env.DB !== undefined || env.HYPERDRIVE !== undefined;

const openSharedDatabase = async (env: AppBindings) => {
  sharedDatabase ??= db.createDatabase(env).catch((error: unknown) => {
    sharedDatabase = undefined;
    throw error;
  });
  return await sharedDatabase;
};

const withServiceContext = async <T>(
  env: AppBindings | undefined,
  run: (context: ServiceContext) => Promise<T>,
): Promise<T> => {
  const bindings = env ?? {};
  if (!hasRequestBinding(bindings)) {
    return await run({ getDatabase: async () => await openSharedDatabase(bindings) });
  }

  let opened: Promise<repositories.Database> | undefined = undefined;
  const getDatabase = async () => {
    opened ??= db.createDatabase(bindings);
    return await opened;
  };
  const closeOpened = async () => {
    const database = await opened?.catch(() => undefined);
    if (database === undefined) {
      return;
    }
    try {
      await database.close();
    } catch (error) {
      logger.warn('Failed to close the request database', { error });
    }
  };

  try {
    return await run({ getDatabase });
  } finally {
    await closeOpened();
  }
};

const closeSharedDatabase = async () => {
  const pending = sharedDatabase;
  sharedDatabase = undefined;
  if (pending !== undefined) {
    const database = await pending;
    await database.close();
  }
};

export { closeSharedDatabase, hasRequestBinding, openSharedDatabase, withServiceContext };
