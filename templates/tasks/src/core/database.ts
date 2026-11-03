import { logger } from '@lightproject/common/logger';
import type { repositories } from '@lightproject/datastore';

interface LazyDatabase {
  getDatabase: () => Promise<repositories.Database>;
  close: () => Promise<void>;
}

const createLazyDatabase = (open: () => Promise<repositories.Database>): LazyDatabase => {
  let opened: Promise<repositories.Database> | undefined = undefined;

  const getDatabase = async () => {
    opened ??= open().catch((error: unknown) => {
      opened = undefined;
      throw error;
    });
    return await opened;
  };

  const close = async () => {
    const pending = opened;
    opened = undefined;
    const database = await pending?.catch(() => undefined);
    if (database === undefined) {
      return;
    }
    try {
      await database.close();
    } catch (error) {
      logger.warn('Failed to close the job database', { error });
    }
  };

  return { close, getDatabase };
};

const noDatabase = async (): Promise<repositories.Database> => {
  await Promise.resolve();
  throw new Error('No database is available to this job executor');
};

export { createLazyDatabase, noDatabase };
export type { LazyDatabase };
