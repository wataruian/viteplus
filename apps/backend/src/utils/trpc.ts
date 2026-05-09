import { randomUUID } from 'node:crypto';

import { endpoints } from '@lightproject/common/configs';
// import { isProduction } from '@lightproject/common/environment';
// import { initTRPC, type TRPCError } from '@trpc/server';
import { initTRPC } from '@trpc/server';
// import type { DefaultErrorShape } from '@trpc/server/unstable-core-do-not-import';
import superjson from 'superjson';
import type { OpenApiMeta } from 'trpc-openapi';
// import { syncLocals } from '../middlewares/gateway-middleware';
import type {
  // ErrorDetails,
  Request,
  Response,
  ServiceContext,
} from '../types/middlware';

// const DEFAULT_ERROR_STATUS_CODE = 500;
const uuidv4 = () => randomUUID();
const transformer = superjson;

// const errorFormatter = ({
// 	ctx,
// 	error,
// 	shape,
// }: {
// 	ctx: ServiceContext | undefined;
// 	error: TRPCError;
// 	shape: DefaultErrorShape;
// }) => {
// 	let errorDetails: ErrorDetails = {
// 		message: shape.message || 'Unknown error occurred',
// 		name: error.name || 'UnknownError',
// 		statusCode: Number(shape.data.httpStatus) || DEFAULT_ERROR_STATUS_CODE,
// 	};

// 	if (ctx) {
// 		ctx.res.locals.originalStatusCode = ctx.res.statusCode;
// 		ctx.res.statusCode = shape.data.httpStatus || DEFAULT_ERROR_STATUS_CODE;

// 		errorDetails = {
// 			message: errorDetails.message,
// 			name: errorDetails.name,
// 			statusCode: ctx.res.statusCode || errorDetails.statusCode,
// 		};

// 		// Only include stack if it exists
// 		if (shape.data.stack) {
// 			errorDetails.stack = shape.data.stack;
// 		}

// 		if (!ctx.req.locals) {
// 			ctx.req.locals = {} as ServiceContext['req']['locals'];
// 		}

// 		if (!ctx.req.locals.metadata) {
// 			ctx.req.locals.metadata =
// 				{} as ServiceContext['req']['locals']['metadata'];
// 		}

// 		ctx.req.locals.metadata.error = errorDetails;

// 		syncLocals({
// 			locals: {
// 				...ctx.req.locals,
// 				...ctx.res.locals,
// 			},
// 			req: ctx.req,
// 			res: ctx.res,
// 			target: 'both',
// 		});
// 	}

// 	const formattedError = {
// 		code: Number(shape.data.code),
// 		data: {
// 			code: shape.data.code,
// 			httpStatus: errorDetails.statusCode,
// 			path: shape.data.path,
// 			stack: error.stack || shape.data.stack,
// 		},
// 		message: error.message || shape.message,
// 	};

// 	if (isProduction()) {
// 		formattedError.data.stack = undefined;
// 	}

// 	return formattedError;
// };

const createContext = (req: Request, res: Response): ServiceContext => {
  const sessionId = req.locals.sessionId || uuidv4();

  if (!req.locals || typeof req.locals !== 'object') {
    req.locals = {
      metadata: {
        method: req.method,
        requestType: endpoints.getRequestType(req.originalUrl),
        startTime: Date.now(),
        url: req.originalUrl,
      },
      sessionId,
    };
  }

  if (!req.locals.sessionId) {
    req.locals.sessionId = sessionId;
  }

  const ctx = {
    req,
    res,
  };

  return ctx;
};

const t = initTRPC.meta<OpenApiMeta>().context<Awaited<ReturnType<typeof createContext>>>().create({
  // errorFormatter,
  transformer,
});

const trpcRouteWrapper = t.middleware(async ({ next }) => {
  const result = await Promise.resolve(next());

  if (
    !result.ok
    // &&
    // ctx &&
    // ctx.req &&
    // ctx.res &&
    // ctx.req.locals &&
    // ctx.res.locals &&
    // ctx.req.locals.metadata &&
    // ctx.res.locals.metadata
  ) {
    // const errorDetails = getErrorDetails(result.error, ctx.res);
    // ctx.req.locals.metadata.error = errorDetails;
    // ctx.res.locals.metadata.error = errorDetails;
    // console.log('Error in TRPC route wrapper:', result.error);
  }

  return result;
});

const { procedure, router: tRouter, mergeRouters: tMergeRouters } = t;

const publicProcedure = procedure.use(trpcRouteWrapper);

const router = tRouter;

const mergeRouters = tMergeRouters;

export { transformer };
export { createContext };
export { t };
export { trpcRouteWrapper };
export { publicProcedure };
export { router };
export { mergeRouters };
