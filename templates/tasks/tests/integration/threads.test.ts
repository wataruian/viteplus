import { fileURLToPath } from 'node:url';

import { generateUuid, sleep } from '@lightproject/common/utils';
import { afterEach, describe, expect, test } from 'vite-plus/test';

import { UnrecoverableJobError } from '../../src/core/function';
import type { Job } from '../../src/core/job';
import { JobAbortedError, JobNotStartedError } from '../../src/core/runner';
import { type ThreadExecutor, createThreadExecutor } from '../../src/runtimes/node';
import { threadTest } from './fixtures/thread-functions';

const entry = new globalThis.URL('fixtures/thread-entry.ts', import.meta.url);
const vitePlusDist = new globalThis.URL('dist/', import.meta.resolve('vite-plus/package.json'));
const execArgv = [
  '--require',
  fileURLToPath(new globalThis.URL('script-preload.cjs', vitePlusDist)),
  '--import',
  new globalThis.URL('script-register.js', vitePlusDist).href,
  '--conditions=typescript',
];

const executors: ThreadExecutor[] = [];

afterEach(async () => {
  await Promise.all(
    executors.splice(0).map(async (executor) => {
      await executor.close();
    }),
  );
});

const createExecutor = (abortGraceMs = 100) => {
  const executor = createThreadExecutor(entry, { abortGraceMs, execArgv });
  executors.push(executor);
  return executor;
};

const jobFor = (mode: string): Job => ({
  attempts: 1,
  createdAt: new Date(0),
  dedupeKey: null,
  functionName: threadTest.name,
  id: generateUuid(),
  lastError: null,
  leaseExpiresAt: new Date(30_000),
  leaseOwner: 'worker-1',
  maxAttempts: 1,
  payload: { mode },
  runAt: new Date(0),
  status: 'running',
  updatedAt: new Date(0),
});

const never = () => new globalThis.AbortController().signal;
const done = { skipReason: undefined };

describe('thread executor', () => {
  test('a thread that fails to start does not charge the job, and repeated failures are fatal', async () => {
    const failingEntry = new globalThis.URL('fixtures/failing-entry.ts', import.meta.url);
    let fatal = 0;
    const executor = createThreadExecutor(failingEntry, {
      execArgv,
      onStartFailures: () => {
        fatal += 1;
      },
    });
    executors.push(executor);

    for (const attempt of [1, 2, 3]) {
      await expect(executor.execute(jobFor('ok'), never())).rejects.toThrow(JobNotStartedError);
      expect(fatal).toBe(attempt === 3 ? 1 : 0);
    }
  });

  test('a thread that started reports a later crash as a job failure', async () => {
    const { execute } = createExecutor();
    await expect(execute(jobFor('ok'), never())).resolves.toStrictEqual(done);
    await expect(execute(jobFor('crash'), never())).rejects.not.toThrow(JobNotStartedError);
  });

  test('runs a job in a worker thread', async () => {
    const { execute } = createExecutor();
    await expect(execute(jobFor('ok'), never())).resolves.toStrictEqual(done);
    await expect(execute(jobFor('ok'), never())).resolves.toStrictEqual(done);
  });

  test('carries a skip reason back from the thread', async () => {
    const { execute } = createExecutor();
    await expect(execute(jobFor('skip'), never())).resolves.toStrictEqual({
      skipReason: 'nothing to do',
    });
  });

  test('reports a handler error without losing the thread', async () => {
    const { execute } = createExecutor();
    await expect(execute(jobFor('fail'), never())).rejects.toThrow('handler failed');
    await expect(execute(jobFor('ok'), never())).resolves.toStrictEqual(done);
  });

  test('keeps an unrecoverable failure unrecoverable across the thread boundary', async () => {
    const { execute } = createExecutor();
    await expect(execute(jobFor('unrecoverable'), never())).rejects.toThrow(UnrecoverableJobError);
    await expect(execute(jobFor('fail'), never())).rejects.not.toThrow(UnrecoverableJobError);
  });

  test('a crashing job only takes down its own thread', async () => {
    const { execute } = createExecutor();
    await expect(execute(jobFor('crash'), never())).rejects.toThrow(
      'Worker thread exited with code 3',
    );
    await expect(execute(jobFor('ok'), never())).resolves.toStrictEqual(done);
  });

  test('an error thrown in an idle thread retires it instead of crashing the process', async () => {
    const { execute } = createExecutor();
    await expect(execute(jobFor('stray'), never())).resolves.toStrictEqual(done);
    await sleep(100);
    await expect(execute(jobFor('ok'), never())).resolves.toStrictEqual(done);
  });

  test('a CPU-bound job that ignores abort is terminated and the worker continues', async () => {
    const { execute } = createExecutor();
    await expect(execute(jobFor('ok'), never())).resolves.toStrictEqual(done);
    const startedAt = Date.now();

    await expect(execute(jobFor('hang'), globalThis.AbortSignal.timeout(200))).rejects.toThrow(
      JobAbortedError,
    );
    expect(Date.now() - startedAt).toBeLessThan(2000);
    await expect(execute(jobFor('ok'), never())).resolves.toStrictEqual(done);
  });

  test('reports an abort only after the thread has stopped the attempt', async () => {
    const { execute } = createExecutor(300);
    const startedAt = Date.now();

    await expect(execute(jobFor('hang'), globalThis.AbortSignal.timeout(100))).rejects.toThrow(
      JobAbortedError,
    );
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(400);
  });

  test('terminates the thread when it reports its handler still running after an abort', async () => {
    const { execute } = createExecutor(6000);
    await expect(execute(jobFor('ok'), never())).resolves.toStrictEqual(done);
    const startedAt = Date.now();

    await expect(execute(jobFor('ignore'), globalThis.AbortSignal.timeout(100))).rejects.toThrow(
      JobAbortedError,
    );
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(6000);
    await expect(execute(jobFor('ok'), never())).resolves.toStrictEqual(done);
  }, 15_000);

  test('reports an abort as soon as the thread exits during the grace period', async () => {
    const { execute } = createExecutor(5000);
    await expect(execute(jobFor('ok'), never())).resolves.toStrictEqual(done);
    const startedAt = Date.now();

    await expect(
      execute(jobFor('exit-on-abort'), globalThis.AbortSignal.timeout(100)),
    ).rejects.toThrow(JobAbortedError);
    expect(Date.now() - startedAt).toBeLessThan(2000);
    await expect(execute(jobFor('ok'), never())).resolves.toStrictEqual(done);
  });

  test('keeps the thread when an aborted handler settles within the grace period', async () => {
    const { execute } = createExecutor(5000);
    await expect(execute(jobFor('ok'), never())).resolves.toStrictEqual(done);
    const startedAt = Date.now();

    await expect(
      execute(jobFor('cooperative'), globalThis.AbortSignal.timeout(100)),
    ).rejects.toThrow(JobAbortedError);
    expect(Date.now() - startedAt).toBeLessThan(2000);
    await expect(execute(jobFor('ok'), never())).resolves.toStrictEqual(done);
  });

  test('forwards abort to the handler signal', async () => {
    const { execute } = createExecutor(5000);
    await expect(
      execute(jobFor('cooperative'), globalThis.AbortSignal.timeout(100)),
    ).rejects.toThrow(JobAbortedError);
  });

  test('one hung worker does not block another', async () => {
    const hung = createExecutor();
    const healthy = createExecutor();

    const hanging = expect(
      hung.execute(jobFor('hang'), globalThis.AbortSignal.timeout(500)),
    ).rejects.toThrow(JobAbortedError);
    await expect(healthy.execute(jobFor('ok'), never())).resolves.toStrictEqual(done);
    await hanging;
  });

  test('refuses to start an already-aborted job', async () => {
    const { execute } = createExecutor();
    await expect(execute(jobFor('ok'), globalThis.AbortSignal.abort())).rejects.toThrow();
  });
});
