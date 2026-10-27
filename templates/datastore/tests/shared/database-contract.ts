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

const pause = async (ms: number) => {
  await new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
};

const newLockName = () => `script-${globalThis.crypto.randomUUID()}`;

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

    describe('script locks', () => {
      const start = Date.parse('2026-01-01T00:00:00.000Z');
      const at = (ms: number) => new Date(start + ms);

      targetTest('acquire takes a free lock once until it is released', async (target) => {
        const { scriptLocks } = target.database;
        const lock = newLockName();

        await expect(scriptLocks.acquire({ leaseMs: 1000, name: lock, owner: 'a' })).resolves.toBe(
          true,
        );
        await expect(scriptLocks.acquire({ leaseMs: 1000, name: lock, owner: 'b' })).resolves.toBe(
          false,
        );
        await expect(scriptLocks.findByName(lock)).resolves.toMatchObject({
          name: lock,
          owner: 'a',
        });
        await expect(scriptLocks.release({ name: lock, owner: 'b' })).resolves.toBe(false);
        await expect(scriptLocks.release({ name: lock, owner: 'a' })).resolves.toBe(true);
        await expect(scriptLocks.findByName(lock)).resolves.toBeUndefined();
        await expect(scriptLocks.acquire({ leaseMs: 1000, name: lock, owner: 'b' })).resolves.toBe(
          true,
        );
      });

      targetTest('acquire takes over an expired lease, and only that', async (target) => {
        const { scriptLocks } = target.database;
        const lock = newLockName();

        await expect(
          scriptLocks.acquire({ leaseMs: 1000, name: lock, now: at(0), owner: 'crashed' }),
        ).resolves.toBe(true);
        await expect(
          scriptLocks.acquire({ leaseMs: 1000, name: lock, now: at(999), owner: 'early' }),
        ).resolves.toBe(false);
        await expect(
          scriptLocks.acquire({ leaseMs: 1000, name: lock, now: at(1000), owner: 'next' }),
        ).resolves.toBe(true);
        await expect(scriptLocks.findByName(lock)).resolves.toMatchObject({
          createdAt: at(1000),
          expiresAt: at(2000),
          owner: 'next',
        });
        await expect(scriptLocks.release({ name: lock, owner: 'crashed' })).resolves.toBe(false);
      });

      targetTest(
        'on the database clock, a live lease holds and an expired one is taken over',
        async (target) => {
          const { scriptLocks } = target.database;
          const live = newLockName();
          const short = newLockName();

          await expect(
            scriptLocks.acquire({ leaseMs: 60_000, name: live, owner: 'a' }),
          ).resolves.toBe(true);
          await expect(
            scriptLocks.acquire({ leaseMs: 60_000, name: live, owner: 'b' }),
          ).resolves.toBe(false);
          await expect(
            scriptLocks.acquire({ leaseMs: 1000, name: short, owner: 'a' }),
          ).resolves.toBe(true);
          await expect(
            scriptLocks.acquire({ leaseMs: 60_000, name: short, owner: 'b' }),
          ).resolves.toBe(false);
          await pause(1500);
          await expect(
            scriptLocks.acquire({ leaseMs: 60_000, name: short, owner: 'b' }),
          ).resolves.toBe(true);
          await expect(scriptLocks.findByName(short)).resolves.toMatchObject({ owner: 'b' });
          await expect(scriptLocks.findByName(live)).resolves.toMatchObject({ owner: 'a' });
        },
      );

      targetTest(
        'renew extends only its own lease, until another owner took it over',
        async (target) => {
          const { scriptLocks } = target.database;
          const lock = newLockName();

          await expect(
            scriptLocks.acquire({ leaseMs: 1000, name: lock, now: at(0), owner: 'a' }),
          ).resolves.toBe(true);
          await expect(
            scriptLocks.renew({ leaseMs: 1000, name: lock, now: at(800), owner: 'a' }),
          ).resolves.toBe(true);
          await expect(scriptLocks.findByName(lock)).resolves.toMatchObject({
            expiresAt: at(1800),
            owner: 'a',
          });
          await expect(
            scriptLocks.acquire({ leaseMs: 1000, name: lock, now: at(1500), owner: 'b' }),
          ).resolves.toBe(false);
          await expect(
            scriptLocks.renew({ leaseMs: 1000, name: lock, now: at(1500), owner: 'b' }),
          ).resolves.toBe(false);
          await expect(
            scriptLocks.acquire({ leaseMs: 1000, name: lock, now: at(1800), owner: 'b' }),
          ).resolves.toBe(true);
          await expect(
            scriptLocks.renew({ leaseMs: 1000, name: lock, now: at(1900), owner: 'a' }),
          ).resolves.toBe(false);
          await expect(scriptLocks.findByName(lock)).resolves.toMatchObject({
            expiresAt: at(2800),
            owner: 'b',
          });
        },
      );

      targetTest('renew on the database clock keeps a short lease alive', async (target) => {
        const { scriptLocks } = target.database;
        const lock = newLockName();

        await expect(scriptLocks.acquire({ leaseMs: 1000, name: lock, owner: 'a' })).resolves.toBe(
          true,
        );
        await pause(600);
        await expect(scriptLocks.renew({ leaseMs: 1000, name: lock, owner: 'a' })).resolves.toBe(
          true,
        );
        await pause(600);
        await expect(scriptLocks.acquire({ leaseMs: 1000, name: lock, owner: 'b' })).resolves.toBe(
          false,
        );
      });

      targetTest('concurrent acquires of one name let exactly one through', async (target) => {
        const { scriptLocks } = target.database;
        const lock = newLockName();

        const results = await Promise.all(
          ['a', 'b', 'c', 'd'].map(
            async (owner) => await scriptLocks.acquire({ leaseMs: 60_000, name: lock, owner }),
          ),
        );

        expect(results.filter(Boolean)).toHaveLength(1);
      });
    });

    describe('worker job queue', () => {
      const start = Date.parse('2026-01-01T00:00:00.000Z');
      const at = (ms: number) => new Date(start + ms);
      const pending = (overrides: Partial<types.NewWorkerJob> = {}) =>
        newJob({ createdAt: at(0), runAt: at(0), updatedAt: at(0), ...overrides });
      const claim = async (target: ContractTarget, functionName: string, owner: string, ms = 0) =>
        await target.database.workerJobs.claim({
          functionName,
          leaseMs: 1000,
          leaseOwner: owner,
          now: at(ms),
        });

      targetTest(
        'enqueue returns the existing job, unchanged, for a repeated dedupe key',
        async (target) => {
          const { workerJobs } = target.database;
          const first = await workerJobs.enqueue(pending({ dedupeKey: 'order-1' }));
          const repeat = pending({
            dedupeKey: 'order-1',
            functionName: first.functionName,
            payload: { other: true },
            updatedAt: at(999),
          });

          await expect(workerJobs.enqueue(repeat)).resolves.toStrictEqual(first);
          await expect(workerJobs.findById(first.id)).resolves.toStrictEqual(first);
          await expect(workerJobs.findById(repeat.id)).resolves.toBeUndefined();
          await expect(workerJobs.enqueue(pending({ dedupeKey: 'order-1' }))).resolves.not.toEqual(
            first,
          );
        },
      );

      targetTest('enqueue throws on a duplicate id instead of absorbing it', async (target) => {
        const { workerJobs } = target.database;
        const job = await workerJobs.enqueue(pending({ dedupeKey: 'id-clash' }));

        await expect(workerJobs.enqueue(pending({ id: job.id }))).rejects.toThrow();
        await expect(
          workerJobs.enqueue(pending({ dedupeKey: 'other', id: job.id })),
        ).rejects.toThrow();
        await expect(workerJobs.findById(job.id)).resolves.toStrictEqual(job);
      });

      targetTest('claim takes the oldest due job once and counts the attempt', async (target) => {
        const { workerJobs } = target.database;
        const functionName = `fn-${globalThis.crypto.randomUUID()}`;
        const later = await workerJobs.enqueue(pending({ functionName, runAt: at(500) }));
        const due = await workerJobs.enqueue(pending({ functionName, runAt: at(-100) }));
        await workerJobs.enqueue(pending());

        await expect(claim(target, functionName, 'a')).resolves.toMatchObject({
          attempts: 1,
          id: due.id,
          leaseExpiresAt: at(1000),
          leaseOwner: 'a',
          status: 'running',
          updatedAt: at(0),
        });
        await expect(claim(target, functionName, 'b')).resolves.toBeUndefined();
        await expect(claim(target, functionName, 'b', 500)).resolves.toMatchObject({
          id: later.id,
        });
      });

      targetTest('concurrent claims never hand out the same job twice', async (target) => {
        const { workerJobs } = target.database;
        const functionName = `fn-${globalThis.crypto.randomUUID()}`;
        const jobs = await Promise.all(
          Array.from(
            { length: 10 },
            async () => await workerJobs.enqueue(pending({ functionName })),
          ),
        );

        const claimed = await Promise.all(
          Array.from(
            { length: 15 },
            async (_, index) => await claim(target, functionName, `w${index}`),
          ),
        );
        const ids = claimed.flatMap((job) => (job === undefined ? [] : [job.id]));

        expect(ids).toHaveLength(10);
        expect(new Set(ids)).toStrictEqual(new Set(jobs.map(({ id }) => id)));
      });

      targetTest('only the lease owner can heartbeat, complete or fail', async (target) => {
        const { workerJobs } = target.database;
        const job = await workerJobs.enqueue(pending());
        await claim(target, job.functionName, 'owner');
        const held = { attempt: 1, id: job.id, now: at(10) };

        await expect(
          workerJobs.heartbeat({ ...held, leaseMs: 4990, leaseOwner: 'intruder' }),
        ).resolves.toBe(false);
        await expect(
          workerJobs.heartbeat({ ...held, leaseMs: 4990, leaseOwner: 'owner' }),
        ).resolves.toBe(true);
        await expect(claim(target, job.functionName, 'other', 2000)).resolves.toBeUndefined();
        await expect(workerJobs.complete({ ...held, leaseOwner: 'intruder' })).resolves.toBe(false);
        await expect(workerJobs.complete({ ...held, leaseOwner: 'owner' })).resolves.toBe(true);
        await expect(workerJobs.complete({ ...held, leaseOwner: 'owner' })).resolves.toBe(false);
        await expect(workerJobs.findById(job.id)).resolves.toMatchObject({
          leaseExpiresAt: null,
          leaseOwner: null,
          status: 'succeeded',
          updatedAt: at(10),
        });
      });

      targetTest('fail retries after retryAfterMs, or marks the job dead', async (target) => {
        const { workerJobs } = target.database;
        const job = await workerJobs.enqueue(pending());
        await claim(target, job.functionName, 'owner');

        await expect(
          workerJobs.fail({
            attempt: 1,
            id: job.id,
            lastError: 'boom',
            leaseOwner: 'owner',
            now: at(0),
            retryAfterMs: 300,
          }),
        ).resolves.toBe(true);
        await expect(workerJobs.findById(job.id)).resolves.toMatchObject({
          lastError: 'boom',
          leaseOwner: null,
          runAt: at(300),
          status: 'pending',
        });
        await expect(claim(target, job.functionName, 'owner', 299)).resolves.toBeUndefined();
        await expect(claim(target, job.functionName, 'owner', 300)).resolves.toMatchObject({
          attempts: 2,
        });

        await expect(
          workerJobs.fail({
            attempt: 2,
            id: job.id,
            lastError: 'fatal',
            leaseOwner: 'owner',
            now: at(400),
            retryAfterMs: undefined,
          }),
        ).resolves.toBe(true);
        await expect(workerJobs.findById(job.id)).resolves.toMatchObject({
          lastError: 'fatal',
          runAt: at(300),
          status: 'dead',
        });
      });

      targetTest('an expired lease is reclaimed and fences out the old owner', async (target) => {
        const { workerJobs } = target.database;
        const job = await workerJobs.enqueue(pending());
        await claim(target, job.functionName, 'crashed');

        await expect(claim(target, job.functionName, 'rescuer', 1000)).resolves.toMatchObject({
          attempts: 2,
          leaseOwner: 'rescuer',
        });
        await expect(
          workerJobs.complete({ attempt: 2, id: job.id, leaseOwner: 'crashed', now: at(1000) }),
        ).resolves.toBe(false);
      });

      targetTest(
        'a write from an earlier attempt of the same owner is fenced out',
        async (target) => {
          const { workerJobs } = target.database;
          const job = await workerJobs.enqueue(pending());
          await claim(target, job.functionName, 'w');
          await claim(target, job.functionName, 'w', 1000);

          await expect(
            workerJobs.heartbeat({
              attempt: 1,
              id: job.id,
              leaseMs: 8000,
              leaseOwner: 'w',
              now: at(1000),
            }),
          ).resolves.toBe(false);
          await expect(
            workerJobs.complete({ attempt: 1, id: job.id, leaseOwner: 'w', now: at(1000) }),
          ).resolves.toBe(false);
          await expect(
            workerJobs.complete({ attempt: 2, id: job.id, leaseOwner: 'w', now: at(1000) }),
          ).resolves.toBe(true);
        },
      );

      targetTest('an expired lease is reclaimed before an older pending job', async (target) => {
        const { workerJobs } = target.database;
        const crashed = await workerJobs.enqueue(pending());
        await claim(target, crashed.functionName, 'crashed');
        const older = await workerJobs.enqueue(
          pending({ functionName: crashed.functionName, runAt: at(-5000) }),
        );

        await expect(claim(target, crashed.functionName, 'w', 1000)).resolves.toMatchObject({
          id: crashed.id,
        });
        await expect(claim(target, crashed.functionName, 'w', 1000)).resolves.toMatchObject({
          id: older.id,
        });
      });

      targetTest('a dead job is revived by a repeated dedupe key', async (target) => {
        const { workerJobs } = target.database;
        const job = await workerJobs.enqueue(pending({ dedupeKey: 'revive', maxAttempts: 1 }));
        await claim(target, job.functionName, 'w');
        await workerJobs.fail({
          attempt: 1,
          id: job.id,
          lastError: 'down',
          leaseOwner: 'w',
          now: at(0),
          retryAfterMs: undefined,
        });

        const revived = await workerJobs.enqueue(
          pending({
            dedupeKey: 'revive',
            functionName: job.functionName,
            maxAttempts: 4,
            payload: { again: true },
            runAt: at(50),
            updatedAt: at(50),
          }),
        );

        expect(revived).toMatchObject({
          attempts: 0,
          id: job.id,
          lastError: null,
          maxAttempts: 4,
          payload: { again: true },
          runAt: at(50),
          status: 'pending',
        });
        await expect(
          workerJobs.enqueue(
            pending({ dedupeKey: 'revive', functionName: job.functionName, payload: { x: 1 } }),
          ),
        ).resolves.toMatchObject({ id: job.id, payload: { again: true } });
      });

      targetTest('release hands a job back without charging the attempt', async (target) => {
        const { workerJobs } = target.database;
        const job = await workerJobs.enqueue(pending());
        await claim(target, job.functionName, 'owner');
        const held = { attempt: 1, id: job.id, leaseOwner: 'owner', now: at(20) };

        await expect(workerJobs.release({ ...held, leaseOwner: 'intruder' })).resolves.toBe(false);
        await expect(workerJobs.release({ ...held, attempt: 2 })).resolves.toBe(false);
        await expect(workerJobs.release(held)).resolves.toBe(true);
        await expect(workerJobs.findById(job.id)).resolves.toMatchObject({
          attempts: 0,
          leaseExpiresAt: null,
          leaseOwner: null,
          runAt: at(20),
          status: 'pending',
        });
        await expect(claim(target, job.functionName, 'next', 20)).resolves.toMatchObject({
          attempts: 1,
          leaseOwner: 'next',
        });
      });

      targetTest('without `now`, lease times come from the database clock', async (target) => {
        const { workerJobs } = target.database;
        const job = await workerJobs.enqueue(
          newJob({
            runAt: new Date(Date.now() - 60_000),
            updatedAt: new Date(Date.now() - 60_000),
          }),
        );
        const before = Date.now();
        const claimed = await workerJobs.claim({
          functionName: job.functionName,
          leaseMs: 30_000,
          leaseOwner: 'w',
        });
        const after = Date.now();

        expect(claimed?.id).toBe(job.id);
        const leaseEnd = claimed?.leaseExpiresAt?.getTime() ?? 0;
        expect(leaseEnd).toBeGreaterThanOrEqual(before + 30_000 - 1000);
        expect(leaseEnd).toBeLessThanOrEqual(after + 30_000 + 1000);
        await expect(
          workerJobs.heartbeat({ attempt: 1, id: job.id, leaseMs: 60_000, leaseOwner: 'w' }),
        ).resolves.toBe(true);
        await expect(
          workerJobs.fail({
            attempt: 1,
            id: job.id,
            lastError: 'x',
            leaseOwner: 'w',
            retryAfterMs: 60_000,
          }),
        ).resolves.toBe(true);
        const retried = await workerJobs.findById(job.id);
        expect(retried?.runAt.getTime()).toBeGreaterThanOrEqual(before + 60_000 - 1000);
        await expect(
          workerJobs.claim({ functionName: job.functionName, leaseMs: 1000, leaseOwner: 'w' }),
        ).resolves.toBeUndefined();
      });

      targetTest('purge deletes only old finished jobs of one status', async (target) => {
        const { workerJobs } = target.database;
        const finish = async (status: 'dead' | 'succeeded', updatedAt: Date) => {
          const job = await workerJobs.enqueue(pending({ dedupeKey: 'purge' }));
          await claim(target, job.functionName, 'w');
          await (status === 'dead'
            ? workerJobs.fail({
                attempt: 1,
                id: job.id,
                lastError: 'x',
                leaseOwner: 'w',
                now: updatedAt,
                retryAfterMs: undefined,
              })
            : workerJobs.complete({ attempt: 1, id: job.id, leaseOwner: 'w', now: updatedAt }));
          return job;
        };
        const old = new Date('1950-01-01T00:00:00.000Z');
        const oldSucceeded = await finish('succeeded', old);
        const oldDead = await finish('dead', old);
        const recent = await finish('succeeded', at(0));
        const waiting = await workerJobs.enqueue(pending({ updatedAt: old }));
        const cutoff = new Date('1950-01-02T00:00:00.000Z');

        await expect(
          workerJobs.purge({ limit: 1000, status: 'succeeded', updatedBefore: cutoff }),
        ).resolves.toBeGreaterThanOrEqual(1);
        await expect(workerJobs.findById(oldSucceeded.id)).resolves.toBeUndefined();
        await expect(workerJobs.findById(oldDead.id)).resolves.toMatchObject({ status: 'dead' });
        await expect(workerJobs.findById(recent.id)).resolves.toMatchObject({
          status: 'succeeded',
        });
        await expect(workerJobs.findById(waiting.id)).resolves.toMatchObject({ status: 'pending' });
        await expect(
          workerJobs.purge({ limit: 1, status: 'dead', updatedBefore: cutoff }),
        ).resolves.toBe(1);
        await expect(workerJobs.findById(oldDead.id)).resolves.toBeUndefined();

        const again = await workerJobs.enqueue(
          pending({ dedupeKey: 'purge', functionName: oldSucceeded.functionName }),
        );
        expect(again.id).not.toBe(oldSucceeded.id);
      });
    });
  });
};

export { describeDatabase };
export type { ContractTarget };
