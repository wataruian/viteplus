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
import { isRecord } from '@lightproject/common/validators';
import { logger } from '@lightproject/common/logger';

const assertIsInputArgs: (val: unknown) => asserts val is InputArgs = (_val: unknown) => {};
const assertIsServiceMethod: (val: unknown) => asserts val is ServiceMethod = (_val: unknown) => {};

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
      const serviceMethod = Reflect.get(serviceClass, String(method));
      if (typeof serviceMethod !== 'function') {
        throw new TypeError(`Method ${String(method)} not found on service ${serviceClass.name}`);
      }

      let inputArgs: InputArgs = {};
      if (isRecord(input)) {
        assertIsInputArgs(input);
        inputArgs = input;
      }

      assertIsServiceMethod(serviceMethod);
      const rawResult: unknown = await invokeWithParsedArgs(serviceMethod, inputArgs);
      const result = isRecord(rawResult) ? rawResult : {};

      const response: BaseResponse = {
        code: typeof result['code'] === 'number' ? result['code'] : 200,
        data:
          isRecord(result['data']) || Array.isArray(result['data']) || result['data'] === null
            ? (result['data'] as BaseResponse['data'])
            : undefined,
        message:
          typeof result['message'] === 'string'
            ? result['message']
            : 'Request processed successfully',
        sessionId: typeof result['sessionId'] === 'string' ? result['sessionId'] : undefined,
        success: typeof result['success'] === 'boolean' ? result['success'] : true,
      };

      return response;
    } catch (error) {
      logger.error(
        `Error in route handler for ${serviceClass.name}.${String(method)}:`,
        isRecord(error) ? error : { error: String(error) },
      );
      throw error;
    }
  };

const createRouteHandler = createRouteHandlerImpl;

export type { RawServiceResult, CreateRouteHandler };
export { createRouteHandlerImpl, createRouteHandler };
