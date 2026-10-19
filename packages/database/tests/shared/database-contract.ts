import { afterAll, describe, expect, test } from 'vite-plus/test';

import type { repositories, types } from '../../src';

interface ContractTarget {
  database: repositories.Database;
  insertJobWithRawStatus: (job: types.NewWorkerJob, status: string) => Promise<void>;
}

const newUser = (): types.NewUser => ({
  email: `${globalThis.crypto.randomUUID()}@example.com`,
  name: 'Ada',
});

const newJob = (overrides: Partial<types.NewWorkerJob> = {}): types.NewWorkerJob => ({
  functionName: `fn-${globalThis.crypto.randomUUID()}`,
  id: globalThis.crypto.randomUUID(),
  maxAttempts: 3,
  payload: { list: [1, 'two', null, true], nested: { ok: true } },
  runAt: new Date('2026-01-01T00:00:00.000Z'),
  status: 'pending',
  ...overrides,
});

const describeDatabase = (name: string, open: () => Promise<ContractTarget>) => {
  describe(`${name} database contract`, () => {
    const opened = open();
    opened.catch(() => {});

    afterAll(async () => {
      const target = await opened;
      await target.database.close();
    });

    const targetTest = (title: string, body: (target: ContractTarget) => Promise<void>) => {
      test(title, async () => {
        await body(await opened);
      });
    };

    targetTest(
      'fills id and timestamps on insert and reads them back as the same types',
      async (target) => {
        const before = Date.now();
        const user = await target.database.users.insert(newUser());

        expect(user.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u);
        expect(user.createdAt).toBeInstanceOf(Date);
        expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before);
        expect(user.updatedAt.getTime()).toBe(user.createdAt.getTime());
        await expect(target.database.users.findById(user.id)).resolves.toStrictEqual(user);
      },
    );

    targetTest('refreshes updatedAt on update', async (target) => {
      const user = await target.database.users.insert(newUser());
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 5);
      });

      const renamed = await target.database.users.update(user.id, { name: 'Grace' });

      expect(renamed?.name).toBe('Grace');
      expect(renamed?.createdAt).toStrictEqual(user.createdAt);
      expect(renamed?.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime());
    });

    targetTest('finds users by email and removes them', async (target) => {
      const { users } = target.database;
      const user = await users.insert(newUser());

      await expect(users.findByEmail(user.email)).resolves.toStrictEqual(user);
      await expect(users.remove(user.id)).resolves.toBe(true);
      await expect(users.remove(user.id)).resolves.toBe(false);
      await expect(users.findById(user.id)).resolves.toBeUndefined();
      await expect(users.findByEmail(user.email)).resolves.toBeUndefined();
      await expect(users.update(user.id, { name: 'Gone' })).resolves.toBeUndefined();
    });

    targetTest('rejects a duplicate email', async (target) => {
      const user = newUser();
      await target.database.users.insert(user);

      await expect(target.database.users.insert({ ...user })).rejects.toThrow();
    });

    targetTest('round-trips a job with JSON payload, Dates and defaults', async (target) => {
      const input = newJob({ leaseExpiresAt: new Date('2026-01-01T00:00:30.123Z') });
      const job = await target.database.workerJobs.insert(input);

      expect(job).toMatchObject({
        attempts: 0,
        dedupeKey: null,
        lastError: null,
        leaseExpiresAt: input.leaseExpiresAt,
        leaseOwner: null,
        payload: input.payload,
        runAt: input.runAt,
        status: 'pending',
      });
      await expect(target.database.workerJobs.findById(job.id)).resolves.toStrictEqual(job);
    });

    targetTest('enforces the status check constraint', async (target) => {
      await expect(target.insertJobWithRawStatus(newJob(), 'lost')).rejects.toThrow();
      await expect(target.insertJobWithRawStatus(newJob(), 'dead')).resolves.toBeUndefined();
    });

    targetTest(
      'dedupe keys are unique per function, and absent keys never collide',
      async (target) => {
        const functionName = `fn-${globalThis.crypto.randomUUID()}`;
        await target.database.workerJobs.insert(newJob({ functionName }));
        await target.database.workerJobs.insert(newJob({ functionName }));
        await target.database.workerJobs.insert(newJob({ dedupeKey: 'k', functionName }));
        await target.database.workerJobs.insert(newJob({ dedupeKey: 'k' }));

        await expect(
          target.database.workerJobs.insert(newJob({ dedupeKey: 'k', functionName })),
        ).rejects.toThrow();
      },
    );
  });
};

export { describeDatabase };
export type { ContractTarget };
