import type { z } from '@hono/zod-openapi';

type ServiceFn<S extends z.ZodRawShape, O extends Record<string, unknown>> = ((
  input: z.output<z.ZodObject<S>>,
) => O | Promise<O>) & {
  schema: { request: z.ZodObject<S>; response: z.ZodType<O> };
};

const attachSchema = <S extends z.ZodRawShape, O extends Record<string, unknown>>(
  fn: (input: z.output<z.ZodObject<S>>) => O | Promise<O>,
  schema: { request: z.ZodObject<S>; response: z.ZodType<O> },
): ServiceFn<S, O> => Object.assign(fn, { schema });

export { attachSchema };
export type { ServiceFn };
