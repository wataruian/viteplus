import type { Job } from '../core/job';
import type { JobStore } from '../core/store';

const snapshot = (job: Job): Job => globalThis.structuredClone(job);

const expiresAt = (job: Job) => Number(job.leaseExpiresAt?.getTime());

const oldestDue = (jobs: Iterable<Job>, functionName: string, now: Date): Job | undefined => {
  let expired: Job | undefined = undefined;
  let pending: Job | undefined = undefined;
  for (const job of jobs) {
    if (job.functionName !== functionName) {
      continue;
    }
    if (
      job.status === 'running' &&
      expiresAt(job) <= now.getTime() &&
      (!expired || expiresAt(job) < expiresAt(expired))
    ) {
      expired = job;
    }
    if (job.status === 'pending' && job.runAt <= now && (!pending || job.runAt < pending.runAt)) {
      pending = job;
    }
  }
  return expired ?? pending;
};

const dedupeIndexKey = (functionName: string, dedupeKey: string) =>
  `${functionName}\u0000${dedupeKey}`;

const timeAt = (now: Date | undefined, plusMs = 0) =>
  new Date((now?.getTime() ?? Date.now()) + plusMs);

const createMemoryStore = (): JobStore => {
  const jobs = new Map<string, Job>();
  const dedupeIndex = new Map<string, string>();

  const updateHeld = async (
    { attempt, id, leaseOwner }: { attempt: number; id: string; leaseOwner: string },
    changes: Partial<Job>,
  ) => {
    await Promise.resolve();
    const job = jobs.get(id);
    if (job?.status !== 'running' || job.leaseOwner !== leaseOwner || job.attempts !== attempt) {
      return false;
    }
    jobs.set(id, { ...job, ...changes });
    return true;
  };

  return {
    claim: async ({ functionName, leaseMs, leaseOwner, now }) => {
      await Promise.resolve();
      const next = oldestDue(jobs.values(), functionName, timeAt(now));
      if (!next) {
        return undefined;
      }
      const claimed: Job = {
        ...next,
        attempts: next.attempts + 1,
        leaseExpiresAt: timeAt(now, leaseMs),
        leaseOwner,
        status: 'running',
        updatedAt: timeAt(now),
      };
      jobs.set(claimed.id, claimed);
      return snapshot(claimed);
    },
    close: async () => {
      await Promise.resolve();
      jobs.clear();
      dedupeIndex.clear();
    },
    complete: async ({ now, ...held }) =>
      await updateHeld(held, {
        leaseExpiresAt: null,
        leaseOwner: null,
        status: 'succeeded',
        updatedAt: timeAt(now),
      }),
    enqueue: async (input) => {
      await Promise.resolve();
      const key =
        input.dedupeKey === null ? undefined : dedupeIndexKey(input.functionName, input.dedupeKey);
      const existingId = key === undefined ? undefined : dedupeIndex.get(key);
      const existing = existingId === undefined ? undefined : jobs.get(existingId);
      if (existing?.status === 'dead') {
        const revived: Job = {
          ...existing,
          attempts: 0,
          lastError: null,
          maxAttempts: input.maxAttempts,
          payload: input.payload,
          runAt: input.runAt,
          status: 'pending',
          updatedAt: input.updatedAt,
        };
        jobs.set(revived.id, revived);
        return snapshot(revived);
      }
      if (existing) {
        return snapshot(existing);
      }
      if (jobs.has(input.id)) {
        throw new Error(`Duplicate job id ${input.id}`);
      }
      const job = snapshot({
        ...input,
        attempts: 0,
        lastError: null,
        leaseExpiresAt: null,
        leaseOwner: null,
        status: 'pending',
      });
      jobs.set(job.id, job);
      if (key !== undefined) {
        dedupeIndex.set(key, job.id);
      }
      return snapshot(job);
    },
    fail: async ({ lastError, now, retryAfterMs, ...held }) =>
      await updateHeld(held, {
        lastError,
        leaseExpiresAt: null,
        leaseOwner: null,
        updatedAt: timeAt(now),
        ...(retryAfterMs === undefined
          ? { status: 'dead' }
          : { runAt: timeAt(now, retryAfterMs), status: 'pending' }),
      }),
    findById: async (id) => {
      await Promise.resolve();
      const job = jobs.get(id);
      return job ? snapshot(job) : undefined;
    },
    heartbeat: async ({ leaseMs, now, ...held }) =>
      await updateHeld(held, { leaseExpiresAt: timeAt(now, leaseMs), updatedAt: timeAt(now) }),
    purge: async ({ limit, status, updatedBefore }) => {
      await Promise.resolve();
      const expired = [...jobs.values()]
        .filter((job) => job.status === status && job.updatedAt < updatedBefore)
        .toSorted((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
        .slice(0, limit);
      for (const job of expired) {
        jobs.delete(job.id);
        if (job.dedupeKey !== null) {
          dedupeIndex.delete(dedupeIndexKey(job.functionName, job.dedupeKey));
        }
      }
      return expired.length;
    },
    release: async ({ now, ...held }) => {
      const job = jobs.get(held.id);
      return await updateHeld(held, {
        attempts: (job?.attempts ?? 1) - 1,
        leaseExpiresAt: null,
        leaseOwner: null,
        runAt: timeAt(now),
        status: 'pending',
        updatedAt: timeAt(now),
      });
    },
  };
};

export { createMemoryStore, dedupeIndexKey, expiresAt, oldestDue, snapshot, timeAt };
