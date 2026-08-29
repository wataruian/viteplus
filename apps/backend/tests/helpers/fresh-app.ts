import { z } from '@hono/zod-openapi';
import { expect, vi } from 'vite-plus/test';

import { createWrappedResponseSchema } from '../../src/routers/utils';

const errorEnvelope = z.object({
  code: z.number(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    statusCode: z.number(),
  }),
  message: z.string(),
  sessionId: z.string(),
  success: z.literal(false),
});

type ParsedErrorEnvelope = z.infer<typeof errorEnvelope>;

const httpEnvelope = createWrappedResponseSchema;

const trpcEnvelope = <T extends z.ZodType>(dataSchema: T) =>
  z.object({ result: z.object({ data: createWrappedResponseSchema(dataSchema) }) });

const stripVolatile = (parsed: ParsedErrorEnvelope) => ({
  ...parsed,
  error: { ...parsed.error, stack: undefined },
  sessionId: 'x',
});

const parseErrorEnvelope = async (res: Response) => errorEnvelope.parse(await res.json());

const expectErrorEnvelope = (
  parsed: ParsedErrorEnvelope,
  expected: { code: string; message?: RegExp | string; stack?: boolean; statusCode: number },
) => {
  expect(parsed.code).toBe(expected.statusCode);
  expect(parsed.error.code).toBe(expected.code);
  expect(parsed.error.statusCode).toBe(expected.statusCode);
  expect(parsed.message).toBe(parsed.error.message);
  expect(parsed.sessionId).toBeDefined();
  expect(parsed.success).toBe(false);

  if (expected.message !== undefined) {
    if (typeof expected.message === 'string') {
      expect(parsed.message).toBe(expected.message);
    } else {
      expect(parsed.message).toMatch(expected.message);
    }
  }

  if (expected.stack !== undefined) {
    if (expected.stack) {
      expect(parsed.error.stack).toBeDefined();
    } else {
      expect(parsed.error.stack).toBeUndefined();
    }
  }
};

const importFreshApp = async (env: Record<string, string> = {}) => {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  const { getApp } = await import('../../src/app');
  return getApp();
};

export {
  errorEnvelope,
  expectErrorEnvelope,
  httpEnvelope,
  importFreshApp,
  parseErrorEnvelope,
  stripVolatile,
  trpcEnvelope,
};
export type { ParsedErrorEnvelope };
