import { bindLogger, logger } from '@lightproject/common/logger';
import {
  type Span,
  SpanStatusCode,
  context,
  describeError,
  getMeter,
  leaseReserveMs,
  propagation,
  raceAbort,
  runWithSpan,
  startLeaseHeartbeat,
  trace,
  tracer,
  withRetry,
} from '@lightproject/common/utils';

import { type JobFunction, UnrecoverableJobError } from './function';
import type { Job } from './job';
import { createIdleBackoff, startLoop } from './loop';
import type { Clock, JobStore } from './store';
import { abortMarginMs, abortGraceMs as defaultAbortGraceMs, maxTimerMs } from './timing';

interface ExecutionResult {
  skipReason: string | undefined;
}

type TraceCarrier = Record<string, string>;

type Executor = (
  job: Job,
  signal: AbortSignal,
  traceContext?: TraceCarrier,
) => Promise<ExecutionResult>;

type JobOutcome =
  | 'succeeded'
  | 'skipped'
  | 'retry'
  | 'dead'
  | 'released'
  | 'lease-lost'
  | 'store-error';

interface RunnerOptions {
  store: JobStore;
  definition: JobFunction;
  workerId: string;
  execute: Executor;
  leaseMs: number;
  clock?: Clock;
  storeClock?: Clock;
  storeRetryDelayMs?: number;
  abortGraceMs?: number;
  shutdown?: AbortSignal;
}

interface WorkerOptions extends RunnerOptions {
  pollIntervalMs: number;
  idlePollMaxMs: number;
}

const storeWriteAttempts = 3;

interface RunningWorker {
  readonly workerId: string;
  stop: () => Promise<void>;
}

interface InProcessExecutorOptions {
  abortGraceMs?: number;
}

const createJobMetrics = () => {
  const meter = getMeter();
  return {
    jobDuration: meter.createHistogram('job_duration', {
      description: 'Job attempt duration',
      unit: 's',
    }),
    jobsProcessed: meter.createCounter('jobs_processed', {
      description: 'Job attempts by function and outcome',
    }),
  };
};

let jobMetrics: ReturnType<typeof createJobMetrics> | undefined = undefined;

const getJobMetrics = () => {
  jobMetrics ??= createJobMetrics();
  return jobMetrics;
};

class JobNotStartedError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'JobNotStartedError';
  }
}

class JobAbortedError extends Error {
  public readonly handlerSettled: boolean;

  public constructor(handlerSettled = true) {
    super('Job aborted');
    this.name = 'JobAbortedError';
    this.handlerSettled = handlerSettled;
  }
}

const raceJobAbort = async <T>(promise: Promise<T>, signal: AbortSignal, graceMs = 0) =>
  await raceAbort(promise, signal, {
    abortError: (settled) => new JobAbortedError(settled),
    graceMs,
    onUnsettled: (ms) => {
      logger.warn(`Job handler ignored abort and is still running after ${ms}ms`);
    },
  });

const endWithOutcome = (span: Span, handling: Promise<void>) => {
  handling.then(
    () => {
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    },
    (error: unknown) => {
      span.recordException(describeError(error));
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
    },
  );
};

const createInProcessExecutor =
  (
    functions: readonly JobFunction[],
    { abortGraceMs = defaultAbortGraceMs }: InProcessExecutorOptions = {},
  ): Executor =>
  async (job, signal, traceContext = {}) => {
    const definition = functions.find(({ name }) => name === job.functionName);
    if (!definition) {
      throw new Error(`No job function registered for "${job.functionName}"`);
    }
    const parent = propagation.extract(context.active(), traceContext);
    const span = tracer.startSpan(
      'job.handler',
      {
        attributes: {
          'job.attempt': job.attempts,
          'job.function': job.functionName,
          'job.id': job.id,
        },
      },
      parent,
    );
    const active = trace.setSpan(parent, span);
    const result: ExecutionResult = { skipReason: undefined };
    const handling = definition.execute(job.payload, {
      attempt: job.attempts,
      idempotencyKey: job.id,
      job,
      logger: bindLogger(active),
      signal,
      skip: (reason) => {
        result.skipReason = reason;
      },
      withTrace: (fn) => context.with(active, fn),
    });
    endWithOutcome(span, handling);
    await raceJobAbort(handling, signal, abortGraceMs);
    return result;
  };

const storeTime = ({ storeClock }: RunnerOptions) =>
  storeClock === undefined ? {} : { now: new Date(storeClock()) };

const startHeartbeat = (
  options: RunnerOptions,
  job: Job,
  claimedAt: number,
  onLost: () => void,
) => {
  const {
    abortGraceMs = defaultAbortGraceMs,
    store,
    workerId,
    leaseMs,
    clock = Date.now,
  } = options;
  const intervalMs = Math.max(1, Math.floor(leaseMs / 4));
  return startLeaseHeartbeat({
    clock,
    heldSince: claimedAt,
    intervalMs,
    leaseMs,
    onLost: (reason) => {
      if (reason === 'expiring') {
        logger.warn('Job lease expires before a heartbeat can renew it; aborting the attempt', {
          jobId: job.id,
          workerId,
        });
      }
      onLost();
    },
    onRenewError: (error) => {
      logger.warn('Job heartbeat failed', { error, jobId: job.id, workerId });
    },
    renew: async () =>
      await store.heartbeat({
        attempt: job.attempts,
        id: job.id,
        leaseMs,
        leaseOwner: workerId,
        ...storeTime(options),
      }),
    reserveMs: leaseReserveMs(intervalMs, abortGraceMs, abortMarginMs),
  });
};

const writeWithRetry = async <T>(
  { storeRetryDelayMs = 250, workerId }: RunnerOptions,
  job: Job,
  write: () => Promise<T>,
): Promise<T> =>
  await withRetry(
    async () => {
      try {
        return await write();
      } catch (error) {
        logger.warn('Recording the job outcome failed', { error, jobId: job.id, workerId });
        throw error;
      }
    },
    storeWriteAttempts,
    storeRetryDelayMs,
  );

const retryDelay = (delayMs: number) =>
  Number.isFinite(delayMs) ? Math.min(maxTimerMs, Math.max(0, Math.round(delayMs))) : maxTimerMs;

const settleFailure = async (
  options: RunnerOptions,
  job: Job,
  message: string,
  retryable = true,
): Promise<JobOutcome> => {
  const { store, definition, workerId } = options;
  const retryAfterMs =
    retryable && job.attempts < job.maxAttempts
      ? retryDelay(definition.backoff(job.attempts))
      : undefined;
  const held = await writeWithRetry(
    options,
    job,
    async () =>
      await store.fail({
        attempt: job.attempts,
        id: job.id,
        lastError: message,
        leaseOwner: workerId,
        retryAfterMs,
        ...storeTime(options),
      }),
  );
  if (!held) {
    return 'lease-lost';
  }
  return retryAfterMs === undefined ? 'dead' : 'retry';
};

const release = async (options: RunnerOptions, job: Job, reason: string): Promise<JobOutcome> => {
  const { store, workerId } = options;
  logger.info('Releasing the job without charging the attempt', {
    jobId: job.id,
    reason,
    workerId,
  });
  const released = await writeWithRetry(
    options,
    job,
    async () =>
      await store.release({
        attempt: job.attempts,
        id: job.id,
        leaseOwner: workerId,
        ...storeTime(options),
      }),
  );
  return released ? 'released' : 'lease-lost';
};

const attemptJob = async (
  options: RunnerOptions,
  job: Job,
  span: Span,
  claimedAt: number,
): Promise<JobOutcome> => {
  const { store, definition, workerId, execute, shutdown } = options;
  if (job.attempts > job.maxAttempts) {
    return await settleFailure(options, job, 'Lease expired during the final attempt');
  }

  const leaseLost = new globalThis.AbortController();
  const timeout = globalThis.AbortSignal.timeout(definition.timeoutMs);
  const stopHeartbeat = startHeartbeat(options, job, claimedAt, () => {
    leaseLost.abort();
  });
  const traceContext: TraceCarrier = {};
  propagation.inject(trace.setSpan(context.active(), span), traceContext);
  const result = await execute(
    job,
    globalThis.AbortSignal.any([leaseLost.signal, timeout, ...(shutdown ? [shutdown] : [])]),
    traceContext,
  )
    .then((value) => ({ ok: true, value }) as const)
    .catch((error: unknown) => ({ error, ok: false }) as const)
    .finally(stopHeartbeat);

  if (result.ok) {
    const { skipReason } = result.value;
    const completed = await writeWithRetry(
      options,
      job,
      async () =>
        await store.complete({
          attempt: job.attempts,
          id: job.id,
          leaseOwner: workerId,
          ...storeTime(options),
        }),
    );
    if (!completed) {
      return 'lease-lost';
    }
    if (skipReason === undefined) {
      return 'succeeded';
    }
    span.setAttribute('job.skip_reason', skipReason);
    runWithSpan(span, () => {
      logger.info('Job skipped', { jobId: job.id, reason: skipReason, workerId });
    });
    return 'skipped';
  }
  if (leaseLost.signal.aborted) {
    return 'lease-lost';
  }
  if (result.error instanceof JobNotStartedError) {
    return await release(options, job, result.error.message);
  }
  if (shutdown?.aborted === true && !timeout.aborted) {
    return await release(options, job, 'worker shutting down');
  }
  const message = timeout.aborted
    ? `Job timed out after ${definition.timeoutMs}ms`
    : describeError(result.error);
  const retryable = !(result.error instanceof UnrecoverableJobError);
  span.recordException(message);
  runWithSpan(span, () => {
    logger.warn('Job attempt failed', { error: message, jobId: job.id, retryable, workerId });
  });
  return await settleFailure(options, job, message, retryable);
};

const nowOf = ({ clock = Date.now }: RunnerOptions) => clock();

const runJob = async (
  options: RunnerOptions,
  job: Job,
  claimedAt = nowOf(options),
): Promise<JobOutcome> => {
  const startedAt = globalThis.performance.now();
  const span = tracer.startSpan('job.run', {
    attributes: {
      'job.attempt': job.attempts,
      'job.function': job.functionName,
      'job.id': job.id,
      'worker.id': options.workerId,
    },
  });

  let outcome: JobOutcome = 'store-error';
  try {
    outcome = await attemptJob(options, job, span, claimedAt);
    return outcome;
  } finally {
    const attributes = { function: job.functionName, outcome };
    const { jobDuration, jobsProcessed } = getJobMetrics();
    jobsProcessed.add(1, attributes);
    jobDuration.record((globalThis.performance.now() - startedAt) / 1000, attributes);
    span.setAttribute('job.outcome', outcome);
    span.setStatus({
      code:
        outcome === 'succeeded' || outcome === 'skipped' || outcome === 'released'
          ? SpanStatusCode.OK
          : SpanStatusCode.ERROR,
    });
    span.end();
  }
};

const processNext = async (options: RunnerOptions): Promise<boolean> => {
  const { store, definition, workerId, leaseMs } = options;
  const claimedAt = nowOf(options);
  const job = await store.claim({
    functionName: definition.name,
    leaseMs,
    leaseOwner: workerId,
    ...storeTime(options),
  });
  if (!job) {
    return false;
  }
  await runJob(options, job, claimedAt);
  return true;
};

const startWorker = (options: WorkerOptions): RunningWorker => {
  const { idlePollMaxMs, pollIntervalMs, workerId } = options;
  const backoff = createIdleBackoff({ maxMs: idlePollMaxMs, minMs: pollIntervalMs });
  const loop = startLoop(
    async () => {
      if (await processNext(options)) {
        backoff.reset();
        return 0;
      }
      return backoff.next();
    },
    (error) => {
      logger.error('Worker poll failed', { error, workerId });
      return backoff.next();
    },
  );
  return { stop: loop.stop, workerId };
};

const drain = async (options: RunnerOptions & { deadline: number }): Promise<number> => {
  const { clock = Date.now, deadline } = options;
  let processed = 0;
  while (clock() < deadline && (await processNext(options))) {
    processed += 1;
  }
  return processed;
};

export {
  JobAbortedError,
  JobNotStartedError,
  attemptJob,
  createInProcessExecutor,
  createJobMetrics,
  drain,
  endWithOutcome,
  getJobMetrics,
  nowOf,
  processNext,
  raceJobAbort,
  release,
  retryDelay,
  runJob,
  settleFailure,
  startHeartbeat,
  startWorker,
  storeTime,
  storeWriteAttempts,
  writeWithRetry,
};
export type {
  ExecutionResult,
  Executor,
  InProcessExecutorOptions,
  JobOutcome,
  RunnerOptions,
  RunningWorker,
  TraceCarrier,
  WorkerOptions,
};
