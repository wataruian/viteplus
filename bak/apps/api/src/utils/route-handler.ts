import { logger } from '@lightproject/common/logger';
import { invoker } from '@lightproject/common/utils';

import type { BaseService } from '../services/base';

const DEFAULT_SUCCESS_CODE = 200;

import type {
  BaseResponse,
  InputArgs,
  RouteHandler,
  ServiceContext,
  ServiceMethod,
} from '../types/middlware';

// Define a callable interface with overloads (HTTP + tRPC)
interface CreateRouteHandler {
  // Prefer this overload in tRPC contexts (picked first by TS)
  <S extends BaseService>(
    serviceClass: new (ctx: ServiceContext, inputArgs?: InputArgs) => S,
    method: keyof S
  ): (opts: { ctx: ServiceContext; input: unknown }) => Promise<BaseResponse>;

  // HTTP middleware shape
  <S extends BaseService>(
    serviceClass: new (ctx: ServiceContext, inputArgs?: InputArgs) => S,
    method: keyof S
  ): RouteHandler;
}

// Single arrow implementation that satisfies the broader (tRPC) param shape
const createRouteHandlerImpl = <S extends BaseService>(
  serviceClass: new (ctx: ServiceContext, inputArgs?: InputArgs) => S,
  method: keyof S
): ((opts: {
  ctx: ServiceContext;
  input: unknown;
}) => Promise<BaseResponse>) => {
  return async ({ ctx, input }: { ctx: ServiceContext; input: unknown }) => {
    try {
      const serviceInstance = new serviceClass(ctx, (input as InputArgs) ?? {});
      const serviceMethod = serviceInstance[method] as ServiceMethod;

      const result = await Promise.resolve(
        invoker.invokeWithParsedArgs(serviceMethod, serviceInstance.input)
      );

      const response = {
        code: result.code || DEFAULT_SUCCESS_CODE,
        data: result.data || undefined,
        message: result.message || 'Request processed successfully',
        sessionId: result.sessionId || undefined,
        success: result.success === undefined ? true : result.success,
      };

      return response;
    } catch (error) {
      logger.error(
        `Error in route handler for ${serviceClass.name}.${String(method)}:`,
        error
      );
      throw error;
    }
  };
};

// Export with overloads while keeping arrow implementation
export const createRouteHandler = createRouteHandlerImpl as CreateRouteHandler;
