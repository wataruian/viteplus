import { generateShortUuid, generateUuid } from '@lightproject/common/utils';
import { afterAll, describe, expect, test } from 'vite-plus/test';

import type { NewJob } from '../../../src/core/job';
import type { Clock, JobStore } from '../../../src/core/store';

interface ContractClock {
  clock: Clock;
  advance: (ms: number) => void;
}

const createClock = (): ContractClock => {
  let now = Date.now();
  return {
    advance: (ms) => {
      now += ms;
    },
    clock: () => now,
  };
};

const describeJobStore = (name: string, createStore: () => Promise<JobStore>) => {
  describe(`${name} store contract`, () => {
    const time = createClock();
    const opened = createStore();
    opened.catch(() => {});

    afterAll(async () => {
      const store = await opened;
      await store.close();
    });

    const storeTest = (title: string, body: (store: JobStore) => Promise<void>) => {
      test(title, async () => {
        await body(await opened);
      });
    };

    const at = (offsetMs = 0) => new Date(time.clock() + offsetMs);

    const newJob = (overrides: Partial<NewJob> = {}): NewJob => ({
      createdAt: at(),
      dedupeKey: null,
      functionName: `fn-${generateShortUuid()}`,
      id: generateUuid(),
      maxAttempts: 3,
      payload: { nested: { list: [1, 'two', null, true] }, value: 'x' },
      runAt: at(),
      updatedAt: at(),
      ...overrides,
    });

    const claim = async (store: JobStore, functionName: string, owner: string, leaseMs = 1000) =>
      await store.claim({
        functionName,
        leaseMs,
        leaseOwner: owner,
        now: at(),
      });

    const held = (id: string, leaseOwner: string, attempt = 1) => ({
      attempt,
      id,
      leaseOwner,
      now: at(),
    });

    storeTest('enqueue stores a pending job and findById reads it back', async (store) => {
      const input = newJob();
      const job = await store.enqueue(input);

      expect(job).toStrictEqual({
        ...input,
        attempts: 0,
        lastError: null,
        leaseExpiresAt: null,
        leaseOwner: null,
        status: 'pending',
      });
      await expect(store.findById(input.id)).resolves.toStrictEqual(job);
      await expect(store.findById(generateUuid())).resolves.toBeUndefined();
    });

    storeTest('a repeated dedupeKey returns the existing job, unchanged', async (store) => {
      const first = await store.enqueue(newJob({ dedupeKey: 'order-1' }));
      const repeat = newJob({
        dedupeKey: 'order-1',
        functionName: first.functionName,
        payload: { other: true },
        updatedAt: at(999),
      });

      await expect(store.enqueue(repeat)).resolves.toStrictEqual(first);
      await expect(store.findById(repeat.id)).resolves.toBeUndefined();
      const otherFunction = await store.enqueue(newJob({ dedupeKey: 'order-1' }));
      expect(otherFunction.id).not.toBe(first.id);
    });

    storeTest('a duplicate id throws', async (store) => {
      const job = await store.enqueue(newJob());

      await expect(store.enqueue(newJob({ id: job.id }))).rejects.toThrow();
      await expect(store.findById(job.id)).resolves.toStrictEqual(job);
    });

    storeTest('claim takes due jobs of one function, oldest first, once', async (store) => {
      const functionName = `fn-${generateShortUuid()}`;
      const later = await store.enqueue(newJob({ functionName, runAt: at(500) }));
      const due = await store.enqueue(newJob({ functionName, runAt: at(-100) }));
      await store.enqueue(newJob());

      await expect(claim(store, functionName, 'worker-a')).resolves.toMatchObject({
        attempts: 1,
        id: due.id,
        leaseExpiresAt: at(1000),
        leaseOwner: 'worker-a',
        status: 'running',
        updatedAt: at(),
      });
      await expect(claim(store, functionName, 'worker-b')).resolves.toBeUndefined();

      time.advance(500);
      await expect(claim(store, functionName, 'worker-b')).resolves.toMatchObject({
        id: later.id,
      });
    });

    storeTest('concurrent claims never hand the same job to two workers', async (store) => {
      const functionName = `fn-${generateShortUuid()}`;
      const jobs = await Promise.all(
        Array.from({ length: 20 }, async () => await store.enqueue(newJob({ functionName }))),
      );

      const claimed = await Promise.all(
        Array.from(
          { length: 30 },
          async (_, index) => await claim(store, functionName, `worker-${index}`, 10_000),
        ),
      );
      const ids = claimed.flatMap((job) => (job === undefined ? [] : [job.id]));

      expect(ids).toHaveLength(20);
      expect(new Set(ids)).toStrictEqual(new Set(jobs.map(({ id }) => id)));
    });

    storeTest('heartbeat extends the lease only for the owner', async (store) => {
      const input = await store.enqueue(newJob());
      await claim(store, input.functionName, 'owner');

      await expect(store.heartbeat({ ...held(input.id, 'intruder'), leaseMs: 5000 })).resolves.toBe(
        false,
      );
      await expect(store.heartbeat({ ...held(input.id, 'owner'), leaseMs: 5000 })).resolves.toBe(
        true,
      );

      time.advance(2000);
      await expect(claim(store, input.functionName, 'other')).resolves.toBeUndefined();
      await expect(store.findById(input.id)).resolves.toMatchObject({
        leaseExpiresAt: at(3000),
      });
    });

    storeTest('complete marks the job succeeded and it is never claimed again', async (store) => {
      const input = await store.enqueue(newJob());
      await claim(store, input.functionName, 'owner');

      await expect(store.complete(held(input.id, 'intruder'))).resolves.toBe(false);
      await expect(store.complete(held(input.id, 'owner'))).resolves.toBe(true);
      await expect(store.complete(held(input.id, 'owner'))).resolves.toBe(false);

      await expect(store.findById(input.id)).resolves.toMatchObject({
        leaseExpiresAt: null,
        leaseOwner: null,
        status: 'succeeded',
      });
      time.advance(10_000);
      await expect(claim(store, input.functionName, 'owner')).resolves.toBeUndefined();
    });

    storeTest('fail with retryAfterMs puts the job back to pending until then', async (store) => {
      const input = await store.enqueue(newJob());
      await claim(store, input.functionName, 'owner');
      const failure = { lastError: 'boom', retryAfterMs: 300 };

      await expect(store.fail({ ...held(input.id, 'intruder'), ...failure })).resolves.toBe(false);
      await expect(store.fail({ ...held(input.id, 'owner'), ...failure })).resolves.toBe(true);

      await expect(store.findById(input.id)).resolves.toMatchObject({
        lastError: 'boom',
        leaseOwner: null,
        runAt: at(300),
        status: 'pending',
      });
      await expect(claim(store, input.functionName, 'other')).resolves.toBeUndefined();

      time.advance(300);
      await expect(claim(store, input.functionName, 'other')).resolves.toMatchObject({
        attempts: 2,
        lastError: 'boom',
        leaseOwner: 'other',
      });
    });

    storeTest('fail without retryAfterMs marks the job dead', async (store) => {
      const input = await store.enqueue(newJob());
      await claim(store, input.functionName, 'owner');

      await expect(
        store.fail({ ...held(input.id, 'owner'), lastError: 'fatal', retryAfterMs: undefined }),
      ).resolves.toBe(true);

      await expect(store.findById(input.id)).resolves.toMatchObject({
        lastError: 'fatal',
        status: 'dead',
      });
      time.advance(10_000);
      await expect(claim(store, input.functionName, 'owner')).resolves.toBeUndefined();
    });

    storeTest('an expired lease is reclaimed and the old owner is fenced out', async (store) => {
      const input = await store.enqueue(newJob());
      await claim(store, input.functionName, 'crashed');

      time.advance(1000);
      await expect(claim(store, input.functionName, 'rescuer')).resolves.toMatchObject({
        attempts: 2,
        leaseOwner: 'rescuer',
      });
      await expect(store.complete(held(input.id, 'crashed', 2))).resolves.toBe(false);
      await expect(
        store.heartbeat({ ...held(input.id, 'crashed', 2), leaseMs: 1000 }),
      ).resolves.toBe(false);
      await expect(store.complete(held(input.id, 'rescuer', 2))).resolves.toBe(true);
    });

    storeTest('a write from an earlier attempt of the same owner is fenced out', async (store) => {
      const input = await store.enqueue(newJob());
      await claim(store, input.functionName, 'w');
      time.advance(1000);
      await claim(store, input.functionName, 'w');

      await expect(store.heartbeat({ ...held(input.id, 'w', 1), leaseMs: 1 })).resolves.toBe(false);
      await expect(store.complete(held(input.id, 'w', 1))).resolves.toBe(false);
      await expect(
        store.fail({ ...held(input.id, 'w', 1), lastError: 'stale', retryAfterMs: undefined }),
      ).resolves.toBe(false);
      await expect(store.complete(held(input.id, 'w', 2))).resolves.toBe(true);
    });

    storeTest('an expired lease is reclaimed before an older pending job', async (store) => {
      const crashed = await store.enqueue(newJob());
      await claim(store, crashed.functionName, 'crashed');
      const older = await store.enqueue(
        newJob({ functionName: crashed.functionName, runAt: at(-5000) }),
      );

      time.advance(1000);
      await expect(claim(store, crashed.functionName, 'w')).resolves.toMatchObject({
        id: crashed.id,
      });
      await expect(claim(store, crashed.functionName, 'w')).resolves.toMatchObject({
        id: older.id,
      });
    });

    storeTest(
      'among expired leases and among pending jobs, the oldest goes first',
      async (store) => {
        const functionName = `fn-${generateShortUuid()}`;
        const late = await store.enqueue(newJob({ functionName }));
        const early = await store.enqueue(newJob({ functionName, runAt: at(-10) }));
        await claim(store, functionName, 'a', 500);
        await claim(store, functionName, 'b', 200);
        const pendingLate = await store.enqueue(newJob({ functionName, runAt: at(-1) }));
        const pendingEarly = await store.enqueue(newJob({ functionName, runAt: at(-2) }));

        time.advance(1000);
        const order = [
          await claim(store, functionName, 'w'),
          await claim(store, functionName, 'w'),
          await claim(store, functionName, 'w'),
          await claim(store, functionName, 'w'),
        ].map((job) => job?.id);

        expect(order).toStrictEqual([late.id, early.id, pendingEarly.id, pendingLate.id]);
      },
    );

    storeTest('a dead job is revived by a repeated dedupe key', async (store) => {
      const input = await store.enqueue(newJob({ dedupeKey: 'revive', maxAttempts: 1 }));
      await claim(store, input.functionName, 'w');
      await store.fail({ ...held(input.id, 'w'), lastError: 'down', retryAfterMs: undefined });

      const revived = await store.enqueue(
        newJob({
          dedupeKey: 'revive',
          functionName: input.functionName,
          maxAttempts: 4,
          payload: { again: true },
        }),
      );

      expect(revived).toMatchObject({
        attempts: 0,
        id: input.id,
        lastError: null,
        maxAttempts: 4,
        payload: { again: true },
        status: 'pending',
      });
      await expect(
        store.enqueue(newJob({ dedupeKey: 'revive', functionName: input.functionName })),
      ).resolves.toMatchObject({ id: input.id, payload: { again: true } });
    });

    storeTest('release hands a job back without charging the attempt', async (store) => {
      const input = await store.enqueue(newJob());
      await claim(store, input.functionName, 'owner');

      await expect(store.release(held(input.id, 'intruder'))).resolves.toBe(false);
      await expect(store.release(held(generateUuid(), 'owner'))).resolves.toBe(false);
      await expect(store.release(held(input.id, 'owner'))).resolves.toBe(true);
      await expect(store.findById(input.id)).resolves.toMatchObject({
        attempts: 0,
        leaseExpiresAt: null,
        leaseOwner: null,
        status: 'pending',
      });
      await expect(claim(store, input.functionName, 'next')).resolves.toMatchObject({
        attempts: 1,
      });
    });

    storeTest('without `now`, the store uses its own clock', async (store) => {
      const input = await store.enqueue(newJob({ runAt: new Date(Date.now() - 60_000) }));
      const before = Date.now();
      const claimed = await store.claim({
        functionName: input.functionName,
        leaseMs: 30_000,
        leaseOwner: 'w',
      });

      expect(claimed?.id).toBe(input.id);
      expect(claimed?.leaseExpiresAt?.getTime()).toBeGreaterThanOrEqual(before + 29_000);
      await expect(
        store.heartbeat({ attempt: 1, id: input.id, leaseMs: 30_000, leaseOwner: 'w' }),
      ).resolves.toBe(true);
      await expect(
        store.fail({
          attempt: 1,
          id: input.id,
          lastError: 'x',
          leaseOwner: 'w',
          retryAfterMs: 60_000,
        }),
      ).resolves.toBe(true);
      await expect(
        store.claim({ functionName: input.functionName, leaseMs: 1000, leaseOwner: 'w' }),
      ).resolves.toBeUndefined();
    });

    storeTest('purge deletes only old finished jobs of one status', async (store) => {
      const finish = async (overrides: Partial<NewJob>, outcome: 'dead' | 'succeeded') => {
        const job = await store.enqueue(newJob(overrides));
        await claim(store, job.functionName, 'w');
        await (outcome === 'dead'
          ? store.fail({ ...held(job.id, 'w'), lastError: 'x', retryAfterMs: undefined })
          : store.complete(held(job.id, 'w')));
        return job;
      };
      const oldSucceeded = await finish({ dedupeKey: 'purge-me' }, 'succeeded');
      const oldDead = await finish({}, 'dead');
      const pending = await store.enqueue(newJob());
      const running = await store.enqueue(newJob());
      await claim(store, running.functionName, 'w');
      time.advance(1000);
      const cutoff = at();
      const newSucceeded = await finish({}, 'succeeded');
      time.advance(10_000);

      await expect(
        store.purge({ limit: 1000, status: 'succeeded', updatedBefore: cutoff }),
      ).resolves.toBeGreaterThanOrEqual(1);
      await expect(store.findById(oldSucceeded.id)).resolves.toBeUndefined();
      await expect(store.findById(oldDead.id)).resolves.toMatchObject({ status: 'dead' });
      await expect(store.findById(newSucceeded.id)).resolves.toMatchObject({
        status: 'succeeded',
      });

      await expect(
        store.purge({ limit: 1000, status: 'dead', updatedBefore: cutoff }),
      ).resolves.toBeGreaterThanOrEqual(1);
      await expect(store.findById(oldDead.id)).resolves.toBeUndefined();
      await expect(store.findById(pending.id)).resolves.toMatchObject({ status: 'pending' });
      await expect(store.findById(running.id)).resolves.toMatchObject({ status: 'running' });

      const again = await store.enqueue(
        newJob({ dedupeKey: 'purge-me', functionName: oldSucceeded.functionName }),
      );
      expect(again.id).not.toBe(oldSucceeded.id);
    });

    storeTest('purge honors limit, oldest first', async (store) => {
      const ancient = new Date('1950-01-01T00:00:00.000Z');
      const finishAt = async (updatedAt: Date) => {
        const job = await store.enqueue(newJob());
        await claim(store, job.functionName, 'w');
        await store.complete({ attempt: 1, id: job.id, leaseOwner: 'w', now: updatedAt });
        return job;
      };
      const oldest = await finishAt(ancient);
      const next = await finishAt(new Date(ancient.getTime() + 1));

      await expect(
        store.purge({ limit: 1, status: 'succeeded', updatedBefore: new Date('1950-01-02') }),
      ).resolves.toBe(1);
      await expect(store.findById(oldest.id)).resolves.toBeUndefined();
      await expect(store.findById(next.id)).resolves.toMatchObject({ status: 'succeeded' });
    });
  });
};

export { createClock, describeJobStore };
export type { ContractClock };
