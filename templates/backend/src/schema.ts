import type { z } from '@hono/zod-openapi';
import type { Span } from '@lightproject/common/utils';
import type { db, repositories } from '@lightproject/datastore';

interface NodeBindings {
  incoming?: { socket?: { remoteAddress?: string } };
}

type AppBindings = NodeBindings & db.DatabaseEnv;

interface AppEnv {
  Bindings: AppBindings;
  Variables: {
    clientId: string | undefined;
    logUrl: string | undefined;
    requestId: string;
    span: Span | undefined;
  };
}

interface ServiceContext {
  getDatabase: () => Promise<repositories.Database>;
}

type ServiceFn<S extends z.ZodRawShape, O extends Record<string, unknown>> = ((
  input: z.output<z.ZodObject<S>>,
  context: ServiceContext,
) => O | Promise<O>) & {
  schema: { request: z.ZodObject<S>; response: z.ZodType<O> };
};

const attachSchema = <S extends z.ZodRawShape, O extends Record<string, unknown>>(
  fn: (input: z.output<z.ZodObject<S>>, context: ServiceContext) => O | Promise<O>,
  schema: { request: z.ZodObject<S>; response: z.ZodType<O> },
): ServiceFn<S, O> => Object.assign(fn, { schema });

export { attachSchema };
export type { AppBindings, AppEnv, NodeBindings, ServiceContext, ServiceFn };
