import { describe, expect, test } from 'vite-plus/test';

import { schemas, type types } from '../../src';

const job: types.WorkerJob = {
  attempts: 1,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  dedupeKey: null,
  functionName: 'ping',
  id: 'job-1',
  lastError: null,
  leaseExpiresAt: new Date('2026-01-01T00:00:30.000Z'),
  leaseOwner: 'worker-1',
  maxAttempts: 3,
  payload: { list: [1, 'two', null, true] },
  runAt: new Date('2026-01-01T00:00:00.000Z'),
  status: 'running',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('schemas', () => {
  test('workerJob accepts a row and rejects a malformed one', () => {
    const parsed: types.WorkerJob = schemas.workerJob.parse(globalThis.structuredClone(job));

    expect(parsed).toStrictEqual(job);
    expect(() => schemas.workerJob.parse({ ...job, status: 'lost' })).toThrow();
    expect(() => schemas.workerJob.parse({ ...job, runAt: 0 })).toThrow();
  });

  test('user accepts a row', () => {
    const user: types.User = {
      createdAt: new Date(0),
      email: 'ada@example.com',
      id: globalThis.crypto.randomUUID(),
      name: 'Ada',
      updatedAt: new Date(0),
    };

    expect(schemas.user.parse(user)).toStrictEqual(user);
  });
});
