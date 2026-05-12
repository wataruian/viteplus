import type {
  BaseResponse,
  InputArgs,
  RouteHandler,
  RouteHandlerParams,
  ServiceContext,
  ServiceMethod,
} from '../types/middlware';
import type { BaseService } from '../services/base';
import { invokeWithParsedArgs } from '@lightproject/common/utils';
import { logger } from '@lightproject/common/logger';

type CreateRouteHandler = <
  C extends new (ctx: ServiceContext, inputArgs?: InputArgs) => BaseService,
>(
  serviceClass: C,
  method: keyof C,
) => RouteHandler;

type RawServiceResult = Partial<BaseResponse> & Record<string, unknown>;

const createRouteHandlerImpl =
  <C extends new (ctx: ServiceContext, inputArgs?: InputArgs) => BaseService>(
    serviceClass: C,
    method: keyof C,
  ): RouteHandler =>
  async (params: RouteHandlerParams) => {
    const { input } = params as { ctx: ServiceContext; input?: unknown };
    try {
      const serviceMethod = (serviceClass as unknown as Record<string, ServiceMethod>)[
        method as unknown as string
      ];

      const rawResult = await invokeWithParsedArgs(serviceMethod, (input as InputArgs) ?? {});

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
