import { schemas } from '@lightproject/database';
import { z } from 'zod';

import type { Job } from '../core/job';
import type { TraceCarrier } from '../core/runner';

type ThreadRequest =
  | { job: Job; traceContext: TraceCarrier; type: 'run' }
  | { jobId: string; type: 'abort' }
  | { type: 'shutdown' };

const threadRequestSchema: z.ZodType<ThreadRequest> = z.discriminatedUnion('type', [
  z.object({
    job: schemas.workerJob,
    traceContext: z.record(z.string(), z.string()),
    type: z.literal('run'),
  }),
  z.object({ jobId: z.string(), type: z.literal('abort') }),
  z.object({ type: z.literal('shutdown') }),
]);

const threadResponseSchema = z.object({
  error: z.string().optional(),
  handlerRunning: z.boolean().optional(),
  jobId: z.string(),
  skipReason: z.string().optional(),
  unrecoverable: z.boolean().optional(),
});

type ThreadResponse = z.infer<typeof threadResponseSchema>;

const threadReadySchema = z.object({ type: z.literal('ready') });

type ThreadReady = z.infer<typeof threadReadySchema>;

export { threadReadySchema, threadRequestSchema, threadResponseSchema };
export type { ThreadReady, ThreadRequest, ThreadResponse };
