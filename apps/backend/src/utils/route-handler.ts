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

type RawServiceResult = Partial<BaseResponse> & Record<string, unknown>;

const createRouteHandlerImpl =
  <S extends BaseService>(
    serviceClass: new (ctx: ServiceContext, inputArgs?: InputArgs) => S,
    method: keyof S,
  ): ((opts: { ctx: ServiceContext; input: unknown }) => Promise<BaseResponse>) =>
  async ({ ctx, input }: { ctx: ServiceContext; input: unknown }) => {
    try {
      const serviceInstance = new serviceClass(ctx, (input as InputArgs) ?? {});

      const serviceMethod = serviceInstance[method] as ServiceMethod;

      const rawResult = await invokeWithParsedArgs(serviceMethod, serviceInstance.input);

      const result = rawResult as RawServiceResult;

      const response: BaseResponse = {
        code: typeof result.code === 'number' ? result.code : 200,
        data: result.data,
        message:
          typeof result.message === 'string' ? result.message : 'Request processed successfully',
        sessionId: typeof result.sessionId === 'string' ? result.sessionId : undefined,
        success: typeof result.success === 'boolean' ? result.success : true,
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

export type { RawServiceResult, CreateRouteHandler };
export { createRouteHandlerImpl, createRouteHandler };
