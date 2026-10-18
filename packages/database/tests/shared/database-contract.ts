import { afterAll, describe, expect, test } from 'vite-plus/test';

import type { NewUser, NewWorkerJob, User, WorkerJob } from '../../src';

interface ContractTarget {
  insertUser: (user: NewUser) => Promise<User>;
  findUser: (id: string) => Promise<User | undefined>;
  renameUser: (id: string, name: string) => Promise<User | undefined>;
  insertJob: (job: NewWorkerJob) => Promise<WorkerJob>;
  findJob: (id: string) => Promise<WorkerJob | undefined>;
  insertJobWithRawStatus: (job: NewWorkerJob, status: string) => Promise<void>;
  close: () => Promise<void>;
}

const newUser = (): NewUser => ({
  email: `${globalThis.crypto.randomUUID()}@example.com`,
  name: 'Ada',
});

const newJob = (overrides: Partial<NewWorkerJob> = {}): NewWorkerJob => ({
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
      await target.close();
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
        const user = await target.insertUser(newUser());

        expect(user.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u);
        expect(user.createdAt).toBeInstanceOf(Date);
        expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before);
        expect(user.updatedAt.getTime()).toBe(user.createdAt.getTime());
        await expect(target.findUser(user.id)).resolves.toStrictEqual(user);
      },
    );

    targetTest('refreshes updatedAt on update', async (target) => {
      const user = await target.insertUser(newUser());
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 5);
      });

      const renamed = await target.renameUser(user.id, 'Grace');

      expect(renamed?.name).toBe('Grace');
      expect(renamed?.createdAt).toStrictEqual(user.createdAt);
      expect(renamed?.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime());
    });

    targetTest('rejects a duplicate email', async (target) => {
      const user = newUser();
      await target.insertUser(user);

      await expect(target.insertUser({ ...user })).rejects.toThrow();
    });

    targetTest('round-trips a job with JSON payload, Dates and defaults', async (target) => {
      const input = newJob({ leaseExpiresAt: new Date('2026-01-01T00:00:30.123Z') });
      const job = await target.insertJob(input);

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
      await expect(target.findJob(job.id)).resolves.toStrictEqual(job);
    });

    targetTest('enforces the status check constraint', async (target) => {
      await expect(target.insertJobWithRawStatus(newJob(), 'lost')).rejects.toThrow();
      await expect(target.insertJobWithRawStatus(newJob(), 'dead')).resolves.toBeUndefined();
    });

    targetTest(
      'dedupe keys are unique per function, and absent keys never collide',
      async (target) => {
        const functionName = `fn-${globalThis.crypto.randomUUID()}`;
        await target.insertJob(newJob({ functionName }));
        await target.insertJob(newJob({ functionName }));
        await target.insertJob(newJob({ dedupeKey: 'k', functionName }));
        await target.insertJob(newJob({ dedupeKey: 'k' }));

        await expect(target.insertJob(newJob({ dedupeKey: 'k', functionName }))).rejects.toThrow();
      },
    );
  });
};

export { describeDatabase };
export type { ContractTarget };
