import type {
  BaseResponse,
  InputArgs,
  RouteHandler,
  ServiceContext,
  ServiceMethod,
} from '../types/middlware';
import type { BaseService } from '../services/base';
import { invokeWithParsedArgs } from '@lightproject/common/utils';
import { logger } from '@lightproject/common/logger';

interface CreateRouteHandler {
  <S extends BaseService>(
    serviceClass: new (ctx: ServiceContext, inputArgs?: InputArgs) => S,
    method: keyof S,
  ): (opts: { ctx: ServiceContext; input: unknown }) => Promise<BaseResponse>;
  <S extends BaseService>(
    serviceClass: new (ctx: ServiceContext, inputArgs?: InputArgs) => S,
    method: keyof S,
  ): RouteHandler;
}

const createRouteHandlerImpl =
  <S extends BaseService>(
    serviceClass: new (ctx: ServiceContext, inputArgs?: InputArgs) => S,
    method: keyof S,
  ): ((opts: { ctx: ServiceContext; input: unknown }) => Promise<BaseResponse>) =>
  async ({ ctx, input }: { ctx: ServiceContext; input: unknown }) => {
    try {
      const serviceInstance = new serviceClass(ctx, (input as InputArgs) ?? {});
      const serviceMethod = serviceInstance[method] as ServiceMethod;

      const result = await Promise.resolve(
        invokeWithParsedArgs(serviceMethod, serviceInstance.input),
      );

      const response = {
        code: result.code || 200,
        data: result.data || undefined,
        message: result.message || 'Request processed successfully',
        sessionId: result.sessionId || undefined,
        success: result.success === undefined ? true : result.success,
      };

      return response;
    } catch (error) {
      logger.error(
        `Error in route handler for ${serviceClass.name}.${String(method)}:`,
        error as Record<string, unknown>,
      );
      throw error;
    }
  };

const createRouteHandler = createRouteHandlerImpl as CreateRouteHandler;

export type { CreateRouteHandler };
export { createRouteHandlerImpl, createRouteHandler };
