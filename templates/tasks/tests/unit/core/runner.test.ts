import { logger } from '@lightproject/common/logger';
import { initializeContextPropagation } from '@lightproject/common/server';
import {
  type Span,
  SpanStatusCode,
  context as otelContext,
  sleep,
  trace,
  tracer,
} from '@lightproject/common/utils';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { type JobContext, UnrecoverableJobError } from '../../../src/core/function';
import {
  JobAbortedError,
  JobNotStartedError,
  createInProcessExecutor,
  drain,
  processNext,
  raceJobAbort,
  runJob,
  startWorker,
} from '../../../src/core/runner';
import { claimFor, setup } from '../helpers/jobs';

afterEach(() => {
  vi.restoreAllMocks();
  otelContext.disable();
});

const stubSpan = () => {
  const span = trace.wrapSpanContext({
    spanId: '00000000000000a1',
    traceFlags: 1,
    traceId: '000000000000000000000000000000b2',
  });
  return {
    end: vi.spyOn(span, 'end'),
    recordException: vi.spyOn(span, 'recordException'),
    setStatus: vi.spyOn(span, 'setStatus'),
    span,
  };
};

const claimNext = async ({ runner, store, time }: ReturnType<typeof setup>) => {
  const job = await store.claim(
    claimFor(time.clock, runner.definition.name, runner.workerId, runner.leaseMs),
  );
  if (!job) {
    throw new Error('expected a due job');
  }
  return job;
};

describe('raceJobAbort', () => {
  test('throws JobAbortedError once aborted', async () => {
    await expect(
      raceJobAbort(Promise.resolve(1), globalThis.AbortSignal.abort()),
    ).rejects.toMatchObject({
      handlerSettled: true,
      message: 'Job aborted',
      name: 'JobAbortedError',
    });
  });

  test('marks a handler that outlives the grace and warns', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const controller = new globalThis.AbortController();
    const raced = raceJobAbort(Promise.withResolvers<undefined>().promise, controller.signal, 20);

    controller.abort();
    await expect(raced).rejects.toMatchObject({ handlerSettled: false, name: 'JobAbortedError' });
    expect(warn).toHaveBeenCalledWith('Job handler ignored abort and is still running after 20ms');
  });
});

describe('createInProcessExecutor', () => {
  test('passes the job context to the handler', async () => {
    const received: JobContext[] = [];
    const context = setup({
      handler: async ({ value }, jobContext) => {
        await Promise.resolve();
        expect(value).toBe(3);
        received.push(jobContext);
      },
    });
    const job = await context.client.enqueue(context.definition, { value: 3 });
    const { signal } = new globalThis.AbortController();

    await expect(context.runner.execute(job, signal)).resolves.toStrictEqual({
      skipReason: undefined,
    });

    const [{ logger: jobLogger, skip, withTrace, ...rest }] = received;
    expect(rest).toStrictEqual({ attempt: 0, idempotencyKey: job.id, job, signal });
    expect(Object.keys(jobLogger).toSorted()).toStrictEqual(['debug', 'error', 'info', 'warn']);
    expect(skip).toBeTypeOf('function');
    expect(withTrace(() => 7)).toBe(7);
  });

  test('binds the job logger and withTrace to the handler span, even after an await', async () => {
    initializeContextPropagation();
    const active: (Span | undefined)[] = [];
    const record = () => {
      active.push(trace.getActiveSpan());
    };
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      vi.spyOn(logger, level).mockImplementation(record);
    }
    const context = setup({
      handler: async (_payload, { logger: jobLogger, withTrace }) => {
        await Promise.resolve();
        expect(trace.getActiveSpan()).toBeUndefined();
        jobLogger.debug('d');
        jobLogger.info('i');
        jobLogger.warn('w');
        jobLogger.error('e');
        withTrace(record);
      },
    });
    const job = await context.client.enqueue(context.definition, { value: 1 });

    await context.runner.execute(job, new globalThis.AbortController().signal);

    expect(active).toHaveLength(5);
    expect(new Set(active).size).toBe(1);
    expect(active[0]).toBeDefined();
  });

  test.each([
    ['succeeds', async () => {}, SpanStatusCode.OK, []],
    [
      'fails',
      async () => {
        await Promise.reject(new Error('boom'));
      },
      SpanStatusCode.ERROR,
      [['boom']],
    ],
  ])('ends the handler span when the handler %s', async (_name, handler, code, exceptions) => {
    const { end, recordException, setStatus, span } = stubSpan();
    vi.spyOn(tracer, 'startSpan').mockReturnValue(span);
    const context = setup({ handler });
    const job = await context.client.enqueue(context.definition, { value: 1 });

    await context.runner.execute(job, new globalThis.AbortController().signal).catch(() => {});

    expect(setStatus).toHaveBeenCalledWith({ code });
    expect(recordException.mock.calls).toStrictEqual(exceptions);
    expect(end).toHaveBeenCalledTimes(1);
  });

  test('ends the handler span only when an aborted handler settles', async () => {
    const { end, span } = stubSpan();
    vi.spyOn(tracer, 'startSpan').mockReturnValue(span);
    const { promise: released, resolve: release } = Promise.withResolvers<undefined>();
    const context = setup({
      handler: async () => {
        await released;
      },
    });
    const job = await context.client.enqueue(context.definition, { value: 1 });
    const execute = createInProcessExecutor([context.definition], { abortGraceMs: 10 });

    await expect(execute(job, globalThis.AbortSignal.abort())).rejects.toThrow(JobAbortedError);
    expect(end).not.toHaveBeenCalled();
    release(undefined);
    await sleep();
    expect(end).toHaveBeenCalledTimes(1);
  });

  test('rejects a job whose function is not registered', async () => {
    const context = setup();
    const job = await context.client.enqueue(context.definition, { value: 1 });

    await expect(
      createInProcessExecutor([])(job, new globalThis.AbortController().signal),
    ).rejects.toThrow('No job function registered for "test"');
  });
});

describe('runJob', () => {
  test('marks a successful job succeeded', async () => {
    const context = setup();
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext(context);

    await expect(runJob(context.runner, job)).resolves.toBe('succeeded');
    await expect(context.store.findById(job.id)).resolves.toMatchObject({ status: 'succeeded' });
  });

  test('records a skipped run as finished, with its own outcome', async () => {
    const info = vi.spyOn(logger, 'info');
    const context = setup({
      handler: async (_payload, { skip }) => {
        await Promise.resolve();
        skip('user was deleted');
      },
    });
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext(context);

    await expect(runJob(context.runner, job)).resolves.toBe('skipped');
    await expect(context.store.findById(job.id)).resolves.toMatchObject({ status: 'succeeded' });
    expect(info).toHaveBeenCalledWith(
      'Job skipped',
      expect.objectContaining({ reason: 'user was deleted' }),
    );
  });

  test('schedules a retry with backoff when the handler throws', async () => {
    const context = setup({
      handler: async () => {
        await Promise.reject(new Error('boom'));
      },
    });
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext(context);

    await expect(runJob(context.runner, job)).resolves.toBe('retry');
    expect(await context.store.findById(job.id)).toMatchObject({
      lastError: 'boom',
      runAt: new Date(context.time.clock() + 1000),
      status: 'pending',
    });
  });

  test('describes a non-Error rejection', async () => {
    const context = setup({
      handler: async () => {
        await Promise.resolve();
        throw Object.assign(Object.create(null), { code: 7 });
      },
    });
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext(context);

    await runJob(context.runner, job);
    await expect(context.store.findById(job.id)).resolves.toMatchObject({
      lastError: '{"code":7}',
    });
  });

  test('marks the job dead after the final attempt', async () => {
    const context = setup({
      handler: async () => {
        await Promise.reject(new Error('still failing'));
      },
      maxAttempts: 1,
    });
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext(context);

    await expect(runJob(context.runner, job)).resolves.toBe('dead');
    await expect(context.store.findById(job.id)).resolves.toMatchObject({ status: 'dead' });
  });

  test('fails a job that runs past its timeout', async () => {
    const context = setup({
      handler: async (_payload, { signal }) => {
        await new Promise((resolve) => {
          signal.addEventListener('abort', resolve);
        });
      },
      timeoutMs: 20,
    });
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext(context);

    await expect(runJob(context.runner, job)).resolves.toBe('retry');
    await expect(context.store.findById(job.id)).resolves.toMatchObject({
      lastError: 'Job timed out after 20ms',
    });
  });

  test('fails an invalid stored payload instead of running the handler', async () => {
    const handler = vi.fn(async () => {
      await Promise.resolve();
    });
    const context = setup({ handler });
    const now = new Date(context.time.clock());
    await context.store.enqueue({
      createdAt: now,
      dedupeKey: null,
      functionName: 'test',
      id: 'bad',
      maxAttempts: 3,
      payload: { value: 'not a number' },
      runAt: now,
      updatedAt: now,
    });
    const job = await claimNext(context);

    await expect(runJob(context.runner, job)).resolves.toBe('dead');
    expect(handler).not.toHaveBeenCalled();
  });

  test('marks a job dead without retrying when the handler throws UnrecoverableJobError', async () => {
    const context = setup({
      handler: async () => {
        await Promise.reject(new UnrecoverableJobError('account closed'));
      },
    });
    await context.client.enqueue(context.definition, { value: 1 }, { maxAttempts: 5 });
    const job = await claimNext(context);

    await expect(runJob(context.runner, job)).resolves.toBe('dead');
    await expect(context.store.findById(job.id)).resolves.toMatchObject({
      attempts: 1,
      lastError: 'account closed',
      status: 'dead',
    });
  });

  test('retries a failed outcome write before giving up', async () => {
    const context = setup();
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext(context);
    const complete = context.store.complete.bind(context.store);
    vi.spyOn(context.store, 'complete')
      .mockRejectedValueOnce(new Error('blip'))
      .mockRejectedValueOnce(new Error('blip'))
      .mockImplementation(complete);
    const runner = { ...context.runner, storeRetryDelayMs: 1 };

    await expect(runJob(runner, job)).resolves.toBe('succeeded');
    await expect(context.store.findById(job.id)).resolves.toMatchObject({ status: 'succeeded' });
  });

  test('stops retrying the outcome write after three tries', async () => {
    const context = setup();
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext(context);
    const complete = vi
      .spyOn(context.store, 'complete')
      .mockRejectedValue(new Error('database down'));
    const runner = { ...context.runner, storeRetryDelayMs: 1 };

    await expect(runJob(runner, job)).rejects.toThrow('database down');
    expect(complete).toHaveBeenCalledTimes(3);
  });

  test('aborts the attempt when failing heartbeats would let the lease expire', async () => {
    const context = setup({
      handler: async (_payload, { signal }) => {
        await new Promise((resolve) => {
          signal.addEventListener('abort', resolve);
        });
      },
    });
    const runner = { ...context.runner, abortGraceMs: 0, leaseMs: 30 };
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext({ ...context, runner });
    vi.spyOn(context.store, 'heartbeat').mockImplementation(async () => {
      context.time.advance(15);
      await Promise.resolve();
      throw new Error('network');
    });
    const fail = vi.spyOn(context.store, 'fail');

    await expect(runJob(runner, job)).resolves.toBe('lease-lost');
    expect(fail).not.toHaveBeenCalled();
  });

  test('aborts the attempt when a heartbeat hangs past the lease', async () => {
    const context = setup({
      handler: async (_payload, { signal }) => {
        await new Promise((resolve) => {
          signal.addEventListener('abort', resolve);
        });
      },
    });
    const runner = { ...context.runner, abortGraceMs: 0, leaseMs: 30 };
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext({ ...context, runner });
    const heartbeat = vi
      .spyOn(context.store, 'heartbeat')
      .mockImplementation(async () => await new Promise<boolean>(() => {}));
    const ticker = globalThis.setInterval(() => {
      context.time.advance(5);
    }, 5);

    try {
      await expect(runJob(runner, job)).resolves.toBe('lease-lost');
    } finally {
      globalThis.clearInterval(ticker);
    }
    expect(heartbeat).toHaveBeenCalledOnce();
  });

  test('measures the lease from now when the job carries no expiry', async () => {
    const context = setup({
      handler: async (_payload, { signal }) => {
        await new Promise((resolve) => {
          signal.addEventListener('abort', resolve);
        });
      },
    });
    const runner = { ...context.runner, abortGraceMs: 0, leaseMs: 30 };
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext({ ...context, runner });
    vi.spyOn(context.store, 'heartbeat').mockImplementation(async () => {
      context.time.advance(15);
      await Promise.resolve();
      throw new Error('network');
    });

    await expect(runJob(runner, { ...job, leaseExpiresAt: null })).resolves.toBe('lease-lost');
  });

  test('aborts and leaves the job alone when a heartbeat finds the lease lost', async () => {
    const context = setup({
      handler: async (_payload, { signal }) => {
        await new Promise((resolve) => {
          signal.addEventListener('abort', resolve);
        });
      },
    });
    const runner = { ...context.runner, abortGraceMs: 0, leaseMs: 30 };
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext(context);
    vi.spyOn(context.store, 'heartbeat').mockResolvedValue(false);
    const fail = vi.spyOn(context.store, 'fail');

    await expect(runJob(runner, job)).resolves.toBe('lease-lost');
    expect(fail).not.toHaveBeenCalled();
  });

  test('heartbeats keep a job that outlives its lease from being reclaimed', async () => {
    const context = setup({
      handler: async () => {
        await sleep(80);
      },
    });
    const runner = { ...context.runner, abortGraceMs: 0, leaseMs: 30 };
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext({ ...context, runner });
    const heartbeat = vi.spyOn(context.store, 'heartbeat');

    const running = runJob(runner, job);
    await sleep(50);
    await expect(
      context.store.claim(claimFor(context.time.clock, 'test', 'other', 30)),
    ).resolves.toBeUndefined();

    await expect(running).resolves.toBe('succeeded');
    expect(heartbeat).toHaveBeenCalled();
  });

  test('rides out a failed heartbeat between successful ones', async () => {
    vi.useFakeTimers();
    try {
      const { promise: released, resolve: release } = Promise.withResolvers<undefined>();
      const context = setup({
        handler: async () => {
          await released;
        },
      });
      const runner = { ...context.runner, abortGraceMs: 0, clock: Date.now, leaseMs: 36 };
      await context.client.enqueue(context.definition, { value: 1 });
      const job = await context.store.claim(claimFor(Date.now, 'test', runner.workerId, 36));
      if (!job) {
        throw new Error('expected a due job');
      }
      const heartbeat = context.store.heartbeat.bind(context.store);
      const warn = vi.spyOn(logger, 'warn');
      vi.spyOn(context.store, 'heartbeat')
        .mockImplementationOnce(heartbeat)
        .mockRejectedValueOnce(new Error('network'))
        .mockImplementation(heartbeat);

      const running = runJob(runner, job);
      await vi.advanceTimersByTimeAsync(100);
      release(undefined);

      await expect(running).resolves.toBe('succeeded');
      expect(warn).toHaveBeenCalledWith('Job heartbeat failed', expect.anything());
    } finally {
      vi.useRealTimers();
    }
  });

  test('reports lease-lost when complete or fail no longer holds the job', async () => {
    const context = setup();
    await context.client.enqueue(context.definition, { value: 1 });
    vi.spyOn(context.store, 'complete').mockResolvedValue(false);
    await expect(runJob(context.runner, await claimNext(context))).resolves.toBe('lease-lost');

    const failing = setup({
      handler: async () => {
        await Promise.reject(new Error('x'));
      },
    });
    await failing.client.enqueue(failing.definition, { value: 1 });
    vi.spyOn(failing.store, 'fail').mockResolvedValue(false);
    await expect(runJob(failing.runner, await claimNext(failing))).resolves.toBe('lease-lost');
  });

  test('a store error after a successful run propagates instead of failing the job', async () => {
    const context = setup();
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext(context);
    vi.spyOn(context.store, 'complete').mockRejectedValue(new Error('db down'));
    const fail = vi.spyOn(context.store, 'fail');

    await expect(runJob(context.runner, job)).rejects.toThrow('db down');
    expect(fail).not.toHaveBeenCalled();
    await expect(context.store.findById(job.id)).resolves.toMatchObject({ status: 'running' });
  });

  test('marks dead without running when a lease expired during the final attempt', async () => {
    const handler = vi.fn(async () => {
      await Promise.resolve();
    });
    const context = setup({ handler, maxAttempts: 1 });
    await context.client.enqueue(context.definition, { value: 1 });
    await claimNext(context);
    context.time.advance(context.runner.leaseMs);
    const reclaimed = await claimNext(context);

    await expect(runJob(context.runner, reclaimed)).resolves.toBe('dead');
    expect(handler).not.toHaveBeenCalled();
    await expect(context.store.findById(reclaimed.id)).resolves.toMatchObject({
      lastError: 'Lease expired during the final attempt',
    });
  });
});

describe('processNext', () => {
  test('returns false when nothing is due and true after running a job', async () => {
    const context = setup();
    await expect(processNext(context.runner)).resolves.toBe(false);

    await context.client.enqueue(context.definition, { value: 1 });
    await expect(processNext(context.runner)).resolves.toBe(true);
  });
});

const waitForAbort = async (_payload: { value: number }, { signal }: JobContext) => {
  await new Promise((resolve) => {
    signal.addEventListener('abort', resolve);
  });
};

const neverStarts = async () => {
  await Promise.resolve();
  throw new JobNotStartedError('thread failed to start');
};

describe('retry delay', () => {
  test.each([
    [1500.6, 1501],
    [-5, 0],
    [Number.POSITIVE_INFINITY, 2_147_483_647],
    [Number.NaN, 2_147_483_647],
  ])('stores a custom backoff of %s ms as %s ms', async (backoffMs, storedMs) => {
    const context = setup({
      backoff: () => backoffMs,
      handler: async () => {
        await Promise.reject(new Error('again'));
      },
    });
    await context.client.enqueue(context.definition, { value: 1 }, { maxAttempts: 3 });
    const job = await claimNext(context);

    await expect(runJob(context.runner, job)).resolves.toBe('retry');
    const stored = await context.store.findById(job.id);
    expect(stored?.runAt.getTime()).toBe(context.time.clock() + storedMs);
  });
});

describe('releasing a job', () => {
  test('releases the job without charging the attempt when the worker shuts down', async () => {
    const context = setup({ handler: waitForAbort });
    const shutdown = new globalThis.AbortController();
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext(context);

    const running = runJob({ ...context.runner, shutdown: shutdown.signal }, job);
    shutdown.abort();

    await expect(running).resolves.toBe('released');
    await expect(context.store.findById(job.id)).resolves.toMatchObject({
      attempts: 0,
      status: 'pending',
    });
  });

  test('releases the job when the executor reports it never started', async () => {
    const context = setup();
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext(context);

    await expect(runJob({ ...context.runner, execute: neverStarts }, job)).resolves.toBe(
      'released',
    );
    await expect(context.store.findById(job.id)).resolves.toMatchObject({ attempts: 0 });
  });

  test('reports lease-lost when the release no longer holds the job', async () => {
    const context = setup({ handler: waitForAbort });
    const shutdown = new globalThis.AbortController();
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext(context);
    vi.spyOn(context.store, 'release').mockResolvedValue(false);

    const running = runJob({ ...context.runner, shutdown: shutdown.signal }, job);
    shutdown.abort();

    await expect(running).resolves.toBe('lease-lost');
  });

  test('charges the attempt when the job timed out, even during shutdown', async () => {
    const shutdown = new globalThis.AbortController();
    const context = setup({
      handler: async (_payload, { signal }) => {
        await new Promise((resolve) => {
          signal.addEventListener('abort', resolve);
        });
        shutdown.abort();
      },
      timeoutMs: 20,
    });
    await context.client.enqueue(context.definition, { value: 1 });
    const job = await claimNext(context);

    await expect(runJob({ ...context.runner, shutdown: shutdown.signal }, job)).resolves.toBe(
      'retry',
    );
  });
});

describe('startWorker', () => {
  test('keeps picking jobs until stopped', async () => {
    const seen: number[] = [];
    const context = setup({
      handler: async ({ value }) => {
        await Promise.resolve();
        seen.push(value);
      },
    });
    await Promise.all(
      [1, 2, 3].map(async (value) => await context.client.enqueue(context.definition, { value })),
    );

    const worker = startWorker({ ...context.runner, idlePollMaxMs: 20, pollIntervalMs: 5 });
    await vi.waitFor(() => {
      expect(seen).toHaveLength(3);
    });
    await context.client.enqueue(context.definition, { value: 4 });
    await vi.waitFor(() => {
      expect(seen).toStrictEqual([1, 2, 3, 4]);
    });
    await worker.stop();

    expect(worker.workerId).toBe('worker-1');
  });

  test('waits for the in-flight job when stopped mid-run', async () => {
    const { promise: started, resolve: onStart } = Promise.withResolvers<undefined>();
    const { promise: release, resolve: finish } = Promise.withResolvers<undefined>();
    const context = setup({
      handler: async () => {
        onStart(undefined);
        await release;
      },
    });
    const job = await context.client.enqueue(context.definition, { value: 1 });
    const worker = startWorker({ ...context.runner, idlePollMaxMs: 20, pollIntervalMs: 5 });
    await started;

    const stopped = worker.stop();
    finish(undefined);
    await stopped;

    await expect(context.store.findById(job.id)).resolves.toMatchObject({ status: 'succeeded' });
  });

  test('logs a failed poll and keeps polling', async () => {
    const error = vi.spyOn(logger, 'error');
    const context = setup();
    const claim = vi.spyOn(context.store, 'claim').mockRejectedValueOnce(new Error('db down'));

    const worker = startWorker({ ...context.runner, idlePollMaxMs: 20, pollIntervalMs: 1 });
    await vi.waitFor(() => {
      expect(claim.mock.calls.length).toBeGreaterThan(1);
    });
    await worker.stop();

    expect(error).toHaveBeenCalledWith(
      'Worker poll failed',
      expect.objectContaining({ workerId: 'worker-1' }),
    );
  });
});

describe('drain', () => {
  test('runs due jobs until the queue is empty', async () => {
    const context = setup();
    await context.client.enqueue(context.definition, { value: 1 });
    await context.client.enqueue(context.definition, { value: 2 });

    await expect(drain({ ...context.runner, deadline: context.time.clock() + 1 })).resolves.toBe(2);
  });

  test('stops claiming once the deadline has passed', async () => {
    const context = setup();
    await context.client.enqueue(context.definition, { value: 1 });

    await expect(drain({ ...context.runner, deadline: context.time.clock() })).resolves.toBe(0);
  });
});
