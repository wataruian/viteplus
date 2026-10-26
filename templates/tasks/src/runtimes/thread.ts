import { z } from 'zod';

import { type JobFunction, UnrecoverableJobError } from '../core/function';
import { JobAbortedError, createInProcessExecutor, describeError } from '../core/runner';
import { type ThreadReady, type ThreadResponse, threadRequestSchema } from './thread-protocol';

const invalidRunSchema = z.object({ job: z.object({ id: z.string() }), type: z.literal('run') });

interface MessagePortLike {
  postMessage: (message: ThreadResponse | ThreadReady) => void;
  addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
}

const serveThread = (
  port: MessagePortLike,
  functions: readonly JobFunction[],
  onShutdown: () => void,
) => {
  const execute = createInProcessExecutor(functions);
  const running = new Map<string, AbortController>();

  port.addEventListener('message', (event) => {
    const parsed = threadRequestSchema.safeParse(event.data);
    if (!parsed.success) {
      const jobId = invalidRunSchema.safeParse(event.data);
      if (jobId.success) {
        port.postMessage({
          error: `Invalid job: ${parsed.error.message}`,
          jobId: jobId.data.job.id,
          unrecoverable: true,
        });
      }
      return;
    }
    const message = parsed.data;
    if (message.type === 'abort') {
      running.get(message.jobId)?.abort();
      return;
    }
    if (message.type === 'shutdown') {
      onShutdown();
      return;
    }

    const { job, traceContext } = message;
    const controller = new globalThis.AbortController();
    running.set(job.id, controller);
    execute(job, controller.signal, traceContext)
      .then(({ skipReason }) => {
        port.postMessage({ jobId: job.id, ...(skipReason === undefined ? {} : { skipReason }) });
      })
      .catch((error: unknown) => {
        port.postMessage({
          error: describeError(error),
          jobId: job.id,
          ...(error instanceof JobAbortedError && !error.handlerSettled
            ? { handlerRunning: true }
            : {}),
          ...(error instanceof UnrecoverableJobError ? { unrecoverable: true } : {}),
        });
      })
      .finally(() => {
        running.delete(job.id);
      });
  });
  port.postMessage({ type: 'ready' });
};

export { invalidRunSchema, serveThread };
export type { MessagePortLike };
