import { getEnv, isProduction, isTrue } from '@lightproject/common/environment';
import { logger } from '@lightproject/common/logger';
import { generateUuid } from '@lightproject/common/utils';
import { type TRPCError, initTRPC } from '@trpc/server';
import type { DefaultErrorShape } from '@trpc/server/unstable-core-do-not-import';
import superjson from 'superjson';
import type { OpenApiMeta } from 'trpc-openapi';

import { getErrorDetails } from '../middlewares/gateway-middleware';
import type {
  ErrorDetails,
  Request,
  Response,
  ServiceContext,
} from '../middlewares/initialize-request';

const transformer = superjson;

const errorFormatter = ({
  ctx,
  error,
  shape,
}: {
  ctx: ServiceContext | undefined;
  error: TRPCError;
  shape: DefaultErrorShape;
}) => {
  let errorDetails: ErrorDetails = {
    message: shape.message || 'Unknown error occurred',
    name: error.name || 'UnknownError',
    statusCode: shape.data.httpStatus,
  };

  if (ctx) {
    ctx.res.locals.originalStatusCode = ctx.res.statusCode;
    ctx.res.statusCode = shape.data.httpStatus;

    errorDetails = {
      message: errorDetails.message,
      name: errorDetails.name,
      statusCode: ctx.res.statusCode,
    };

    if (shape.data.stack !== undefined && shape.data.stack !== '') {
      errorDetails.stack = shape.data.stack;
    }

    ctx.req.locals.metadata.error = errorDetails;
  }

  const formattedError = {
    code: errorDetails.statusCode,
    error: {
      code: shape.data.code,
      httpStatus: shape.data.httpStatus,
      message: error.message || shape.message,
      name: error.name,
      path: shape.data.path,
      stack: error.stack ?? shape.data.stack,
      statusCode: errorDetails.statusCode,
    },
    message: error.message || shape.message,
    sessionId: ctx?.req.locals.sessionId,
    success: false,
  };

  const isErrorStackEnabled = isTrue(getEnv('ENABLE_ERROR_STACK')) || !isProduction();

  if (!isErrorStackEnabled) {
    formattedError.error.stack = undefined;
  }

  return formattedError;
};

const createContext = (req: Request, res: Response): ServiceContext => {
  const sessionId = req.locals.sessionId || generateUuid();

  req.locals.sessionId = sessionId;

  return {
    req,
    res,
  };
};

const t = initTRPC.meta<OpenApiMeta>().context<Awaited<ReturnType<typeof createContext>>>().create({
  errorFormatter,
  transformer,
});

const trpcRouteWrapper = t.middleware(async ({ next, ctx }) => {
  const result = await Promise.resolve(next());

  if (!result.ok) {
    const errorDetails = getErrorDetails(result.error, ctx.res);
    ctx.req.locals.metadata.error = errorDetails;
    ctx.res.locals.metadata.error = errorDetails;

    logger.error('Error in TRPC route wrapper:', {
      error:
        result.error instanceof Error
          ? {
              message: result.error.message,
              name: result.error.name,
              stack: result.error.stack,
            }
          : result.error,
    });
  }

  return result;
});

const { procedure, router: tRouter, mergeRouters: tMergeRouters } = t;

const publicProcedure = procedure.use(trpcRouteWrapper);

const router = tRouter;

const mergeRouters = tMergeRouters;

export {
  createContext,
  errorFormatter,
  mergeRouters,
  publicProcedure,
  router,
  t,
  transformer,
  trpcRouteWrapper,
};
