import { db, type repositories } from '@lightproject/datastore';
import { afterAll, beforeAll } from 'vite-plus/test';

import { type LocalD1, startLocalD1 } from './local-d1';

interface LocalDatabase {
  databaseEnv: () => db.DatabaseEnv;
  openDatabase: () => Promise<repositories.Database>;
}

const useLocalDatabase = (): LocalDatabase => {
  const state: { d1?: LocalD1 } = {};

  beforeAll(async () => {
    state.d1 = await startLocalD1();
  }, 60_000);

  afterAll(async () => {
    await state.d1?.dispose();
  });

  const databaseEnv = (): db.DatabaseEnv => {
    if (state.d1 === undefined) {
      throw new Error('local D1 did not start');
    }
    return { DATABASE_DIALECT: 'd1', DB: state.d1.binding };
  };

  const openDatabase = async () => await db.createDatabase(databaseEnv());

  return { databaseEnv, openDatabase };
};

export { useLocalDatabase };
