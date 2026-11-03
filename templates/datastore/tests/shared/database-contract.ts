import { afterAll, describe, expect, test } from 'vite-plus/test';

import type { repositories, types } from '../../src';

interface ContractTarget {
  database: repositories.Database;
  insertJobWithRawStatus: (job: types.NewWorkerJob, status: string) => Promise<void>;
  tables: repositories.Tables;
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

const seed = async (target: ContractTarget, names: readonly string[]) => {
  const tag = globalThis.crypto.randomUUID();
  const base = -Date.now();
  const rows: types.User[] = [];
  for (const [index, first] of names.entries()) {
    rows.push(
      await target.database.users.insert({
        createdAt: new Date(base + index),
        email: `${tag}-${index}@example.com`,
        name: `${first} ${tag}`,
      }),
    );
  }
  return { rows, tag };
};

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

    targetTest('lists users oldest first (ties by id), up to the limit', async (target) => {
      const { users } = target.database;
      const oldest = -Date.now();
      const later = await users.insert({ ...newUser(), createdAt: new Date(oldest + 1) });
      const tied = await Promise.all([
        users.insert({ ...newUser(), createdAt: new Date(oldest) }),
        users.insert({ ...newUser(), createdAt: new Date(oldest) }),
      ]);
      const byId = tied.toSorted((left, right) => (left.id < right.id ? -1 : 1));

      await expect(users.list({ limit: 3 })).resolves.toStrictEqual([...byId, later]);
      await expect(users.list({ limit: 1 })).resolves.toStrictEqual([byId[0]]);
    });

    describe('table queries', () => {
      const order = ['createdAt', 'id'] as const;
      const page = (limit: number) => ({ limit, orderBy: order });
      const byId = { limit: 10, orderBy: ['id'] } as const;

      targetTest(
        'findMany matches every given column, ordered, up to the limit',
        async (target) => {
          const { rows, tag } = await seed(target, ['Ada', 'Ada', 'Grace']);
          const { users } = target.tables;

          await expect(users.findMany({ name: `Ada ${tag}` }, page(10))).resolves.toStrictEqual(
            rows.slice(0, 2),
          );
          await expect(users.findMany({ name: `Ada ${tag}` }, page(1))).resolves.toStrictEqual([
            rows[0],
          ]);
          await expect(
            users.findMany({ email: rows[1].email, name: `Ada ${tag}` }, page(10)),
          ).resolves.toStrictEqual([rows[1]]);
          await expect(
            users.findMany({ email: rows[2].email, name: `Ada ${tag}` }, page(10)),
          ).resolves.toStrictEqual([]);
        },
      );

      targetTest('findMany treats null as IS NULL and skips undefined', async (target) => {
        const { workerJobs } = target.tables;
        const job = await target.database.workerJobs.insert(newJob());

        await expect(
          workerJobs.findMany(
            { dedupeKey: null, functionName: job.functionName, leaseOwner: undefined },
            byId,
          ),
        ).resolves.toStrictEqual([job]);
      });

      targetTest('search combines operators per column', async (target) => {
        const { rows, tag } = await seed(target, ['Ada', 'Grace', 'Linus']);
        const { users } = target.tables;
        const ofTag = { like: `%${tag}` };

        await expect(
          users.search({ createdAt: { gte: rows[1].createdAt }, name: ofTag }, page(10)),
        ).resolves.toStrictEqual(rows.slice(1));
        await expect(
          users.search(
            { createdAt: { gt: rows[0].createdAt, lt: rows[2].createdAt }, name: ofTag },
            page(10),
          ),
        ).resolves.toStrictEqual([rows[1]]);
        await expect(
          users.search({ createdAt: { lte: rows[0].createdAt }, name: ofTag }, page(10)),
        ).resolves.toStrictEqual([rows[0]]);
        await expect(
          users.search({ id: { in: [rows[0].id, rows[2].id] } }, page(10)),
        ).resolves.toStrictEqual([rows[0], rows[2]]);
        await expect(
          users.search({ id: { notIn: [rows[0].id] }, name: ofTag }, page(10)),
        ).resolves.toStrictEqual(rows.slice(1));
        await expect(
          users.search({ id: { ne: rows[0].id }, name: { eq: rows[1].name } }, page(10)),
        ).resolves.toStrictEqual([rows[1]]);
        await expect(users.search({ id: { in: [] } }, page(10))).resolves.toStrictEqual([]);
        await expect(
          users.search({ email: undefined, id: { eq: rows[0].id, gt: undefined } }, page(10)),
        ).resolves.toStrictEqual([rows[0]]);
      });

      targetTest('search like is case-insensitive on every dialect', async (target) => {
        const { rows, tag } = await seed(target, ['Ada', 'Grace']);

        await expect(
          target.tables.users.search({ name: { like: `ADA ${tag.toUpperCase()}` } }, page(10)),
        ).resolves.toStrictEqual([rows[0]]);
      });

      targetTest('search isNull picks null or non-null values', async (target) => {
        const { workerJobs } = target.tables;
        const free = await target.database.workerJobs.insert(newJob());
        const deduped = await target.database.workerJobs.insert(
          newJob({ dedupeKey: globalThis.crypto.randomUUID(), functionName: free.functionName }),
        );
        const sameFunction = { functionName: { eq: free.functionName } };

        await expect(
          workerJobs.search({ ...sameFunction, dedupeKey: { isNull: true } }, byId),
        ).resolves.toStrictEqual([free]);
        await expect(
          workerJobs.search({ ...sameFunction, dedupeKey: { isNull: false } }, byId),
        ).resolves.toStrictEqual([deduped]);
      });

      targetTest(
        'updateBy and removeBy touch only the first match by primary key',
        async (target) => {
          const { rows, tag } = await seed(target, ['Ada', 'Ada']);
          const { users } = target.tables;
          const [firstId, secondId] = [rows[0].id, rows[1].id].toSorted();
          const adaName = `Ada ${tag}`;

          const updated = await users.updateBy('name', adaName, { name: `Renamed ${tag}` });
          expect(updated?.id).toBe(firstId);
          await expect(users.findMany({ name: adaName }, page(10))).resolves.toMatchObject([
            { id: secondId },
          ]);

          const removed = await users.removeBy('name', adaName);
          expect(removed?.id).toBe(secondId);
          await expect(users.removeBy('name', adaName)).resolves.toBeUndefined();
          await expect(users.updateBy('name', adaName, { name: 'x' })).resolves.toBeUndefined();
        },
      );

      targetTest('updateMany and removeMany act on every match and report it', async (target) => {
        const { rows, tag } = await seed(target, ['Ada', 'Ada', 'Grace']);
        const { users } = target.tables;
        const adaName = `Ada ${tag}`;

        const updated = await users.updateMany({ name: adaName }, { name: `Renamed ${tag}` });
        expect(updated.map(({ id }) => id).toSorted()).toStrictEqual(
          [rows[0].id, rows[1].id].toSorted(),
        );
        await expect(users.removeMany({ name: `Renamed ${tag}` })).resolves.toBe(2);
        await expect(users.removeMany({ name: `Renamed ${tag}` })).resolves.toBe(0);
        await expect(target.database.users.findById(rows[2].id)).resolves.toStrictEqual(rows[2]);
      });

      targetTest('updateMany and removeMany refuse an empty where', async (target) => {
        const { users } = target.tables;

        await expect(users.removeMany({})).rejects.toThrow('removeMany needs at least one where');
        await expect(users.updateMany({ email: undefined }, { name: 'x' })).rejects.toThrow(
          'updateMany needs at least one where',
        );
      });

      targetTest('pages descending with an offset', async (target) => {
        const { rows, tag } = await seed(target, ['Ada', 'Grace', 'Linus']);
        const { users } = target.tables;
        const ofTag = { name: { like: `%${tag}` } };
        const newest = { column: 'createdAt', direction: 'desc' } as const;

        await expect(users.search(ofTag, { limit: 2, orderBy: [newest] })).resolves.toStrictEqual([
          rows[2],
          rows[1],
        ]);
        await expect(
          users.search(ofTag, { limit: 2, offset: 2, orderBy: [newest] }),
        ).resolves.toStrictEqual([rows[0]]);
        await expect(
          users.findMany({ email: rows[1].email }, { limit: 1, offset: 1, orderBy: order }),
        ).resolves.toStrictEqual([]);
        await expect(
          users.list({ limit: 1, orderBy: [{ column: 'createdAt', direction: 'asc' }] }),
        ).resolves.toHaveLength(1);
      });

      targetTest('counts matching rows, or all of them', async (target) => {
        const { tag } = await seed(target, ['Ada', 'Ada', 'Grace']);
        const { users } = target.tables;

        await expect(users.count({ name: { like: `%${tag}` } })).resolves.toBe(3);
        await expect(users.count({ name: { eq: `Ada ${tag}` } })).resolves.toBe(2);
        await expect(users.count({ name: { eq: `Nobody ${tag}` } })).resolves.toBe(0);
        await expect(users.count()).resolves.toBeGreaterThanOrEqual(3);
      });

      targetTest('insertMany inserts every row, across bound-parameter chunks', async (target) => {
        const tag = globalThis.crypto.randomUUID();
        const { users } = target.tables;
        const at = new Date(-Date.now());
        const many = Array.from({ length: 45 }, (_, index) => ({
          createdAt: at,
          email: `${tag}-${index}@example.com`,
          name: `Bulk ${tag}`,
          updatedAt: at,
        }));

        const inserted = await users.insertMany(many);

        expect(inserted.map(({ email }) => email)).toStrictEqual(many.map(({ email }) => email));
        await expect(users.count({ name: { eq: `Bulk ${tag}` } })).resolves.toBe(45);
        await expect(users.insertMany([])).resolves.toStrictEqual([]);
      });

      targetTest('upsert inserts, then updates only the given columns', async (target) => {
        const { users } = target.tables;
        const at = new Date(-Date.now());
        const row = { createdAt: at, ...newUser(), updatedAt: at };

        const inserted = await users.upsert(row, { set: { name: 'Grace' }, target: 'email' });
        expect(inserted).toMatchObject({ email: row.email, name: 'Ada' });

        const upserted = await users.upsert(
          { ...row, createdAt: new Date(0), name: 'Ignored' },
          { set: { name: 'Grace' }, target: 'email' },
        );
        expect(upserted).toMatchObject({ createdAt: at, id: inserted.id, name: 'Grace' });
        await expect(users.count({ email: { eq: row.email } })).resolves.toBe(1);
      });

      targetTest('users repository pages, counts, bulk-inserts and upserts', async (target) => {
        const { rows, tag } = await seed(target, ['Ada', 'Grace', 'Linus']);
        const { users } = target.database;
        const where = { name: { like: `%${tag}` } };

        await expect(users.search({ limit: 2, order: 'desc', where })).resolves.toStrictEqual([
          rows[2],
          rows[1],
        ]);
        await expect(users.search({ limit: 2, offset: 1, where })).resolves.toStrictEqual(
          rows.slice(1),
        );
        await expect(users.count({ where })).resolves.toBe(3);
        await expect(users.count()).resolves.toBeGreaterThanOrEqual(3);

        const [bulk] = await users.insertMany([{ email: `${tag}@bulk.example`, name: 'Bulk' }]);
        expect(bulk.createdAt).toBeInstanceOf(Date);

        const [before] = rows;
        await new Promise((resolve) => {
          globalThis.setTimeout(resolve, 5);
        });
        const renamed = await users.upsert({ email: before.email, name: 'Renamed' });
        expect(renamed).toMatchObject({
          createdAt: before.createdAt,
          id: before.id,
          name: 'Renamed',
        });
        expect(renamed.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
      });

      targetTest('users.updateMany and users.removeMany act on every match', async (target) => {
        const { rows, tag } = await seed(target, ['Ada', 'Ada', 'Grace']);
        const { users } = target.database;
        await new Promise((resolve) => {
          globalThis.setTimeout(resolve, 5);
        });

        const renamed = await users.updateMany({
          changes: { name: `Renamed ${tag}` },
          where: { name: `Ada ${tag}` },
        });
        expect(renamed.map(({ id }) => id).toSorted()).toStrictEqual(
          [rows[0].id, rows[1].id].toSorted(),
        );
        for (const user of renamed) {
          expect(user.updatedAt.getTime()).toBeGreaterThan(rows[0].updatedAt.getTime());
        }

        await expect(users.removeMany({ where: { name: `Renamed ${tag}` } })).resolves.toBe(2);
        await expect(users.findById(rows[2].id)).resolves.toStrictEqual(rows[2]);
        await expect(users.removeMany({ where: {} })).rejects.toThrow(
          'removeMany needs at least one where',
        );
        await expect(users.updateMany({ changes: { name: 'x' }, where: {} })).rejects.toThrow(
          'updateMany needs at least one where',
        );
      });

      targetTest('users.findMany and users.search order like list', async (target) => {
        const { rows, tag } = await seed(target, ['Ada', 'Grace']);
        const { users } = target.database;

        await expect(
          users.findMany({ limit: 10, where: { name: `Grace ${tag}` } }),
        ).resolves.toStrictEqual([rows[1]]);
        await expect(
          users.search({ limit: 10, where: { name: { like: `%${tag}` } } }),
        ).resolves.toStrictEqual(rows);
      });
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
