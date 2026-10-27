import { bindLogger } from '@lightproject/common/logger';
import {
  type Context,
  SpanStatusCode,
  context,
  describeError,
  getMeter,
  leaseReserveMs,
  raceAbort,
  settleWithin,
  startLeaseHeartbeat,
  trace,
  tracer,
  withRetry,
} from '@lightproject/common/utils';
import type { repositories } from '@lightproject/datastore';

import {
  InvalidInputError,
  type JsonValue,
  type PreparedRun,
  type Script,
  type ScriptLogger,
  type Trigger,
} from './script';

type RunOutcome =
  | 'succeeded'
  | 'skipped'
  | 'failed'
  | 'invalid-input'
  | 'timed-out'
  | 'aborted'
  | 'lock-lost';

interface RunOptions {
  input: JsonValue;
  lockScope: string;
  openDatabase: () => Promise<repositories.Database>;
  trigger: Trigger;
  abortGraceMs?: number;
  lease?: Lease;
  maxRunMs?: number;
  releaseTimeoutMs?: number;
  scheduledTime?: Date;
  signal?: AbortSignal;
}

interface RunResult {
  durationMs: number;
  outcome: RunOutcome;
  error?: string;
}

const defaultAbortGraceMs = 5000;

interface Lease {
  leaseMs: number;
  renewEveryMs: number;
}

const defaultLease: Lease = { leaseMs: 60_000, renewEveryMs: 15_000 };

const leaseMarginMs = 5000;

const createRunMetrics = () => {
  const meter = getMeter();
  return {
    runDuration: meter.createHistogram('script_duration', {
      description: 'Script run duration',
      unit: 's',
    }),
    runs: meter.createCounter('script_runs', {
      description: 'Script runs by script, trigger and outcome',
    }),
  };
};

let runMetrics: ReturnType<typeof createRunMetrics> | undefined = undefined;

const getRunMetrics = () => {
  runMetrics ??= createRunMetrics();
  return runMetrics;
};

class ScriptAbortedError extends Error {
  public readonly scriptSettled: boolean;

  public constructor(scriptSettled = true) {
    super('Script aborted');
    this.name = 'ScriptAbortedError';
    this.scriptSettled = scriptSettled;
  }
}

const outcomeOf = (error: unknown, timedOut: boolean): RunOutcome => {
  if (error instanceof InvalidInputError) {
    return 'invalid-input';
  }
  if (error instanceof ScriptAbortedError) {
    return timedOut ? 'timed-out' : 'aborted';
  }
  return 'failed';
};

interface Attempt {
  abortGraceMs: number;
  active: Context;
  database: repositories.Database;
  logger: ScriptLogger;
  scheduledTime: Date;
  signal: AbortSignal;
  timeoutError: DOMException;
  trigger: Trigger;
}

interface Attempted {
  outcome: RunOutcome;
  settled: boolean;
  error?: string;
}

const stoppedBy = ({
  signal,
  timeoutError,
}: Pick<Attempt, 'signal' | 'timeoutError'>): Attempted & { error: string } =>
  signal.reason === timeoutError
    ? { error: timeoutError.message, outcome: 'timed-out', settled: true }
    : { error: 'Script aborted', outcome: 'aborted', settled: true };

const abandonOnAbort = async <T>(
  work: Promise<T>,
  signal: AbortSignal,
  graceMs: number,
  cleanUp: (late: T) => Promise<void>,
  pendingCleanups: Promise<void>[],
  cleanUpAfterFailure: () => Promise<void> = async () => {},
): Promise<T> => {
  try {
    return await raceAbort(work, signal, {
      abortError: (settled) => new ScriptAbortedError(settled),
      graceMs,
    });
  } catch (error) {
    if (!(error instanceof ScriptAbortedError)) {
      throw error;
    }
    const cleaning = work.then(cleanUp, cleanUpAfterFailure).catch(() => {});
    if (error.scriptSettled) {
      await cleaning;
    } else {
      pendingCleanups.push(cleaning);
    }
    throw new ScriptAbortedError();
  }
};

const attempt = async (
  run: PreparedRun,
  {
    abortGraceMs,
    active,
    database,
    logger: scriptLogger,
    scheduledTime,
    signal,
    timeoutError,
    trigger,
  }: Attempt,
): Promise<Attempted> => {
  if (signal.aborted) {
    return stoppedBy({ signal, timeoutError });
  }
  try {
    const running = run({
      db: database,
      logger: scriptLogger,
      scheduledTime,
      signal,
      trigger,
      withTrace: (fn) => context.with(active, fn),
    });
    await raceAbort(running, signal, {
      abortError: (settled) => new ScriptAbortedError(settled),
      graceMs: abortGraceMs,
      onUnsettled: (ms) => {
        scriptLogger.warn(`Script ignored abort and is still running after ${ms}ms`);
      },
    });
    return { outcome: 'succeeded', settled: true };
  } catch (error) {
    return {
      error: describeError(error),
      outcome: outcomeOf(error, signal.reason === timeoutError),
      settled: !(error instanceof ScriptAbortedError) || error.scriptSettled,
    };
  }
};

const releaseAttempts = 3;

const releaseRetryMs = 250;

const defaultReleaseTimeoutMs = 5000;

interface Locking {
  pendingCleanups: Promise<void>[];
  releaseTimeoutMs: number;
}

interface Releasing {
  leaseMs: number;
  logger: ScriptLogger;
  timeoutMs: number;
}

const releaseLock = async (
  database: repositories.Database,
  lock: repositories.HeldScriptLock,
  { leaseMs, logger: scriptLogger, timeoutMs }: Releasing,
): Promise<boolean | undefined> => {
  const giveUp = globalThis.AbortSignal.timeout(timeoutMs);
  const tries = { count: 0 };
  const errors: unknown[] = [];
  const releasing = withRetry(
    async () => {
      if (giveUp.aborted) {
        return undefined;
      }
      tries.count += 1;
      try {
        const released = await database.scriptLocks.release(lock);
        return tries.count === 1 || released ? released : undefined;
      } catch (error) {
        errors.push(error);
        throw error;
      }
    },
    releaseAttempts,
    releaseRetryMs,
  ).catch(() => undefined);
  const settled = await settleWithin(releasing, timeoutMs);
  const released = settled ? await releasing : undefined;
  if (released === undefined) {
    scriptLogger.warn(
      'Could not confirm the script lock was released; it frees itself when the lease ends',
      { leaseMs, timedOut: !settled, ...(errors.length > 0 ? { errors } : {}) },
    );
  }
  return released;
};

const renewAfterSlowAcquire = async (
  database: repositories.Database,
  lock: repositories.HeldScriptLock,
  lease: Lease,
  acquireSentAt: number,
) => {
  if (Date.now() - acquireSentAt < lease.renewEveryMs) {
    return acquireSentAt;
  }
  const renewSentAt = Date.now();
  const renewed = await database.scriptLocks
    .renew({ ...lock, leaseMs: lease.leaseMs })
    .catch(() => false);
  return renewed ? renewSentAt : acquireSentAt;
};

const reserveFor = ({ renewEveryMs }: Lease, abortGraceMs: number) =>
  leaseReserveMs(renewEveryMs, abortGraceMs, leaseMarginMs);

const attemptLocked = async (
  run: PreparedRun,
  lock: repositories.HeldScriptLock,
  lease: Lease,
  options: Attempt,
  { pendingCleanups, releaseTimeoutMs }: Locking,
): Promise<Attempted> => {
  const { abortGraceMs, database, logger: scriptLogger, signal } = options;
  const acquireSentAt = Date.now();
  const release = async () =>
    await releaseLock(database, lock, {
      leaseMs: lease.leaseMs,
      logger: scriptLogger,
      timeoutMs: releaseTimeoutMs,
    });
  const acquired = await abandonOnAbort(
    database.scriptLocks.acquire({ ...lock, leaseMs: lease.leaseMs }),
    signal,
    abortGraceMs,
    async (late) => {
      if (late) {
        await release();
      }
    },
    pendingCleanups,
    async () => {
      await release();
    },
  ).catch(async (error: unknown) => {
    if (!(error instanceof ScriptAbortedError)) {
      await release();
    }
    throw error;
  });
  if (!acquired) {
    return { outcome: 'skipped', settled: true };
  }
  const heldSince = await renewAfterSlowAcquire(database, lock, lease, acquireSentAt);
  const lost = new globalThis.AbortController();
  const stopHeartbeat = startLeaseHeartbeat({
    heldSince,
    intervalMs: lease.renewEveryMs,
    leaseMs: lease.leaseMs,
    onLost: (reason) => {
      scriptLogger.warn(
        reason === 'expiring'
          ? 'Script lock could not be renewed in time; aborting the run'
          : 'Script lock was taken over; aborting the run',
        { leaseMs: lease.leaseMs },
      );
      lost.abort();
    },
    onRenewError: (error) => {
      scriptLogger.warn('Renewing the script lock failed', { error });
    },
    renew: async () => await database.scriptLocks.renew({ ...lock, leaseMs: lease.leaseMs }),
    reserveMs: reserveFor(lease, abortGraceMs),
  });
  const attempted = await attempt(run, {
    ...options,
    signal: globalThis.AbortSignal.any([signal, lost.signal]),
  });
  stopHeartbeat();
  let lockLost = lost.signal.aborted;
  if (attempted.settled) {
    const released = await release();
    if (released === false && !lockLost) {
      lockLost = true;
      scriptLogger.error(
        'Script lost its lock while running (did it block the event loop for about its lease or longer?); another run may have overlapped with it',
        { leaseMs: lease.leaseMs },
      );
    }
  } else if (lost.signal.aborted) {
    scriptLogger.error(
      'Script ignored its abort after losing its lock; another run may now overlap with it',
    );
  } else {
    scriptLogger.warn('Script may still be running; its lock stays until the lease ends', {
      leaseMs: lease.leaseMs,
    });
  }
  return lockLost
    ? { ...attempted, error: attempted.error ?? 'Script lost its lock', outcome: 'lock-lost' }
    : attempted;
};

const checkLease = ({ leaseMs, renewEveryMs }: Lease, abortGraceMs: number) =>
  Number.isInteger(leaseMs) &&
  Number.isInteger(renewEveryMs) &&
  renewEveryMs > 0 &&
  renewEveryMs + reserveFor({ leaseMs, renewEveryMs }, abortGraceMs) < leaseMs
    ? undefined
    : `lease of ${leaseMs}ms cannot be renewed every ${renewEveryMs}ms with a ${abortGraceMs}ms abort grace`;

const runScript = async (script: Script, options: RunOptions): Promise<RunResult> => {
  const startedAt = globalThis.performance.now();
  const {
    abortGraceMs = defaultAbortGraceMs,
    input,
    lease = defaultLease,
    lockScope,
    maxRunMs = script.timeoutMs,
    openDatabase,
    releaseTimeoutMs = defaultReleaseTimeoutMs,
    scheduledTime = new Date(),
    signal: stop,
    trigger,
  } = options;
  const timeoutMs = Math.min(script.timeoutMs, maxRunMs);
  const span = tracer.startSpan('script.run', {
    attributes: { 'script.name': script.name, 'script.trigger': trigger },
  });
  const active = trace.setSpan(context.active(), span);
  const scriptLogger = bindLogger(active);
  const lock = {
    name: `${lockScope}/${script.name}`,
    owner: globalThis.crypto.randomUUID(),
  };
  const timeoutError = new globalThis.DOMException('Script timed out', 'TimeoutError');
  const deadline = new globalThis.AbortController();
  const timer = globalThis.setTimeout(() => {
    deadline.abort(timeoutError);
  }, timeoutMs);
  const signal =
    stop === undefined ? deadline.signal : globalThis.AbortSignal.any([stop, deadline.signal]);

  const result: RunResult = { durationMs: 0, outcome: 'succeeded' };
  let database: repositories.Database | undefined = undefined;
  let settled = true;
  const pendingCleanups: Promise<void>[] = [];
  try {
    const leaseProblem = checkLease(lease, abortGraceMs);
    if (leaseProblem !== undefined) {
      throw new Error(leaseProblem);
    }
    const prepared = script.prepare(input);
    if ('error' in prepared) {
      result.outcome = 'invalid-input';
      result.error = prepared.error;
    } else {
      if (signal.aborted) {
        throw new ScriptAbortedError();
      }
      database = await abandonOnAbort(
        openDatabase(),
        signal,
        abortGraceMs,
        async (late) => {
          await late.close().catch((error: unknown) => {
            scriptLogger.warn('Closing a database that opened after the run was abandoned failed', {
              error,
            });
          });
        },
        pendingCleanups,
      );
      const attempted = await attemptLocked(
        prepared.run,
        lock,
        lease,
        {
          abortGraceMs,
          active,
          database,
          logger: scriptLogger,
          scheduledTime,
          signal,
          timeoutError,
          trigger,
        },
        { pendingCleanups, releaseTimeoutMs },
      );
      ({ settled } = attempted);
      result.outcome = attempted.outcome;
      if (attempted.error !== undefined) {
        result.error = attempted.error;
      }
    }
  } catch (error) {
    if (error instanceof ScriptAbortedError) {
      ({ error: result.error, outcome: result.outcome } = stoppedBy({ signal, timeoutError }));
    } else {
      result.outcome = outcomeOf(error, false);
      result.error = describeError(error);
    }
  } finally {
    globalThis.clearTimeout(timer);
  }
  if (
    pendingCleanups.length > 0 &&
    !(await settleWithin(Promise.all(pendingCleanups), abortGraceMs + releaseTimeoutMs))
  ) {
    scriptLogger.warn(
      'Abandoned setup work (opening the database or taking the lock) is still pending; a lock it takes frees itself when its lease ends',
    );
  }
  if (database !== undefined && settled) {
    try {
      await database.close();
    } catch (error) {
      scriptLogger.warn('Closing the database failed', { error });
    }
  }

  result.durationMs = globalThis.performance.now() - startedAt;
  const attributes = { outcome: result.outcome, script: script.name, trigger };
  const { runDuration, runs } = getRunMetrics();
  runs.add(1, attributes);
  runDuration.record(result.durationMs / 1000, attributes);
  span.setAttribute('script.outcome', result.outcome);
  const details = { durationMs: result.durationMs, trigger };
  if (result.error === undefined) {
    span.setStatus({ code: SpanStatusCode.OK });
    if (result.outcome === 'skipped') {
      scriptLogger.warn(
        `Script ${script.name} skipped: a previous run still holds its lock`,
        details,
      );
    } else {
      scriptLogger.info(`Script ${script.name} succeeded`, details);
    }
  } else {
    span.recordException(result.error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    scriptLogger.error(`Script ${script.name} ${result.outcome}`, {
      ...details,
      error: result.error,
    });
  }
  span.end();
  return result;
};

export {
  ScriptAbortedError,
  abandonOnAbort,
  attempt,
  attemptLocked,
  checkLease,
  createRunMetrics,
  defaultAbortGraceMs,
  defaultLease,
  defaultReleaseTimeoutMs,
  getRunMetrics,
  leaseMarginMs,
  outcomeOf,
  releaseAttempts,
  releaseLock,
  releaseRetryMs,
  renewAfterSlowAcquire,
  reserveFor,
  runScript,
  stoppedBy,
};
export type { Attempt, Attempted, Lease, Locking, Releasing, RunOptions, RunOutcome, RunResult };
