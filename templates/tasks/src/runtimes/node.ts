import {
  type MessagePort,
  Worker,
  type WorkerOptions,
  isMainThread,
  parentPort,
} from 'node:worker_threads';

import { logger } from '@lightproject/common/logger';
import { shutdownTelemetry } from '@lightproject/common/server';
import { getServiceInstanceId } from '@lightproject/common/utils';

import { resolveTsxApi } from '#tsx-api';

import { config } from '../config';
import { UnrecoverableJobError } from '../core/function';
import { startPool } from '../core/pool';
import { startPurger } from '../core/retention';
import {
  type ExecutionResult,
  type Executor,
  JobAbortedError,
  JobNotStartedError,
  settleWithin,
} from '../core/runner';
import { abortGraceMs as defaultAbortGraceMs, telemetryFlushMs } from '../core/timing';
import { functions } from '../functions';
import { createJobStore } from '../stores';
import { startTelemetry } from './telemetry';
import { serveThread } from './thread';
import {
  type ThreadRequest,
  type ThreadResponse,
  threadReadySchema,
  threadResponseSchema,
} from './thread-protocol';

interface ThreadExecutor {
  execute: Executor;
  close: () => Promise<void>;
}

const spawnThread = (entry: URL, options: WorkerOptions) => {
  if (!entry.pathname.endsWith('.ts')) {
    return new Worker(entry, options);
  }
  const tsx = JSON.stringify(resolveTsxApi());
  const script = `import(${tsx}).then(({ register }) => { register(); return import(${JSON.stringify(entry.href)}); });`;
  return new Worker(script, { ...options, eval: true });
};

const maxStartFailures = 3;

const parseResponse = (data: unknown): ThreadResponse | undefined => {
  if (threadReadySchema.safeParse(data).success) {
    return undefined;
  }
  const parsed = threadResponseSchema.safeParse(data);
  if (!parsed.success) {
    logger.warn('Ignoring a message outside the worker thread protocol');
    return undefined;
  }
  return parsed.data;
};

const createThreadExecutor = (
  entry: URL,
  {
    abortGraceMs = defaultAbortGraceMs,
    onStartFailures = () => {},
    ...workerOptions
  }: WorkerOptions & {
    abortGraceMs?: number;
    onStartFailures?: () => void;
  } = {},
): ThreadExecutor => {
  let thread: Worker | undefined = undefined;
  const readyThreads = new WeakSet<Worker>();
  let startFailures = 0;

  const startFailed = (worker: Worker, detail: string) => {
    if (readyThreads.has(worker)) {
      return undefined;
    }
    startFailures += 1;
    logger.error('Worker thread failed to start', { detail, startFailures });
    if (startFailures >= maxStartFailures) {
      onStartFailures();
    }
    return new JobNotStartedError(`Worker thread failed to start (${detail})`);
  };

  const retire = (worker: Worker) => {
    if (thread === worker) {
      thread = undefined;
    }
  };

  const spawn = () => {
    const worker = spawnThread(entry, workerOptions);
    worker.on('message', (data: unknown) => {
      if (threadReadySchema.safeParse(data).success) {
        readyThreads.add(worker);
        startFailures = 0;
      }
    });
    worker.on('error', (error) => {
      retire(worker);
      logger.error('Worker thread failed', { error });
    });
    worker.on('exit', () => {
      retire(worker);
    });
    return worker;
  };

  const execute: Executor = async (job, signal, traceContext = {}) => {
    signal.throwIfAborted();
    thread ??= spawn();
    const current = thread;
    const { promise, reject, resolve } = Promise.withResolvers<ExecutionResult>();
    const listeners: (() => void)[] = [];
    const detach = () => {
      for (const remove of listeners) {
        remove();
      }
    };

    const onMessage = (data: unknown) => {
      const response = parseResponse(data);
      if (response?.jobId !== job.id) {
        return;
      }
      detach();
      if (response.error === undefined) {
        resolve({ skipReason: response.skipReason });
      } else if (response.unrecoverable === true) {
        reject(new UnrecoverableJobError(response.error));
      } else {
        reject(new Error(response.error));
      }
    };
    const onError = (error: Error) => {
      detach();
      retire(current);
      reject(startFailed(current, error.message) ?? error);
    };
    const onExit = (code: number) => {
      detach();
      retire(current);
      reject(
        startFailed(current, `exit code ${code}`) ??
          new Error(`Worker thread exited with code ${code}`),
      );
    };
    const onAbort = () => {
      detach();
      let timer: ReturnType<typeof globalThis.setTimeout> | undefined = undefined;
      const grace = {
        end: () => {
          globalThis.clearTimeout(timer);
          current.off('message', grace.onMessage);
          current.off('exit', grace.onExit);
        },
        onExit: () => {
          grace.end();
          reject(new JobAbortedError());
        },
        onMessage: (data: unknown) => {
          const response = parseResponse(data);
          if (response?.jobId === job.id && response.handlerRunning !== true) {
            grace.end();
            reject(new JobAbortedError());
          }
        },
      };
      timer = globalThis.setTimeout(() => {
        grace.end();
        retire(current);
        current
          .terminate()
          .catch(() => {})
          .finally(() => {
            reject(new JobAbortedError());
          });
      }, abortGraceMs);
      current.on('message', grace.onMessage);
      current.once('exit', grace.onExit);
      const abort: ThreadRequest = { jobId: job.id, type: 'abort' };
      current.postMessage(abort, []);
    };

    current.on('message', onMessage);
    current.on('error', onError);
    current.on('exit', onExit);
    signal.addEventListener('abort', onAbort, { once: true });
    listeners.push(
      () => {
        current.off('message', onMessage);
      },
      () => {
        current.off('error', onError);
      },
      () => {
        current.off('exit', onExit);
      },
      () => {
        signal.removeEventListener('abort', onAbort);
      },
    );
    const run: ThreadRequest = { job, traceContext, type: 'run' };
    current.postMessage(run, []);
    return await promise;
  };

  return {
    close: async () => {
      const current = thread;
      thread = undefined;
      if (current === undefined) {
        return;
      }
      const { promise: exited, resolve } = Promise.withResolvers<undefined>();
      current.once('exit', () => {
        resolve(undefined);
      });
      const timer = globalThis.setTimeout(() => {
        current.terminate().catch(() => {});
      }, abortGraceMs);
      const shutdown: ThreadRequest = { type: 'shutdown' };
      current.postMessage(shutdown, []);
      await exited;
      globalThis.clearTimeout(timer);
    },
    execute,
  };
};

const registerShutdown = (stop: () => Promise<void>) => {
  let shuttingDown = false;
  const shutdown = (reason: string, exitCode: number) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info(`${reason}; stopping (in-flight jobs get the shutdown grace)`);
    stop().then(
      () => {
        globalThis.process.exit(exitCode);
      },
      (error: unknown) => {
        logger.error('Graceful shutdown failed', { error });
        globalThis.process.exit(1);
      },
    );
  };
  const onSignal = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      logger.warn(`Received ${signal} again, exiting without waiting for jobs`);
      globalThis.process.exit(1);
    }
    shutdown(`Received ${signal}`, 0);
  };
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) {
    globalThis.process.on(signal, onSignal);
  }
  return shutdown;
};

const start = async (entry: URL) => {
  config.assertKnownFunctions(functions);
  await startTelemetry();

  const store = await createJobStore(config.jobStore);
  logger.info(`Job store: ${config.jobStore}`);

  const executors: ThreadExecutor[] = [];
  const lifecycle: { shutdown?: (reason: string, exitCode: number) => void } = {};
  const pool = startPool({
    concurrency: (definition) => config.concurrencyFor(definition),
    createExecutor: () => {
      const executor = createThreadExecutor(entry, {
        onStartFailures: () => {
          lifecycle.shutdown?.('Worker threads keep failing to start', 1);
        },
      });
      executors.push(executor);
      return executor.execute;
    },
    functions,
    idlePollMaxMs: config.idlePollMaxMs,
    instanceId: getServiceInstanceId(),
    leaseMs: config.leaseMs,
    pollIntervalMs: config.pollIntervalMs,
    store,
  });

  const purger = startPurger({
    ...config.purge,
    intervalMs: config.purgeIntervalMs,
    retention: config.retention,
    store,
  });

  lifecycle.shutdown = registerShutdown(async () => {
    await Promise.all([pool.stop({ graceMs: config.shutdownGraceMs }), purger.stop()]);
    await Promise.all(
      executors.map(async (executor) => {
        await executor.close();
      }),
    );
    await store.close();
    if (!(await settleWithin(shutdownTelemetry(), telemetryFlushMs))) {
      logger.warn(`Telemetry did not flush within ${telemetryFlushMs}ms; exiting without it`);
    }
  });
};

const exitThread = () => {
  globalThis.process.exit(0);
};

const serveWorkerThread = async (port: MessagePort) => {
  await startTelemetry();
  serveThread(port, functions, () => {
    shutdownTelemetry().then(exitThread, exitThread);
  });
};

const bootstrap = (entry: string) => {
  if (!isMainThread) {
    const port = parentPort;
    if (port) {
      serveWorkerThread(port).catch((error: unknown) => {
        logger.error('Failed to start a worker thread', { error });
        globalThis.process.exit(1);
      });
    }
    return;
  }
  start(new globalThis.URL(entry)).catch((error: unknown) => {
    logger.error('Failed to start workers', { error });
    globalThis.process.exit(1);
  });
};

export {
  bootstrap,
  createThreadExecutor,
  exitThread,
  maxStartFailures,
  parseResponse,
  registerShutdown,
  serveWorkerThread,
  spawnThread,
  start,
};
export type { ThreadExecutor };
