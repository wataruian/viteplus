import type {
  BaseResponse,
  ErrorDetails,
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

const isRecordArray = (val: unknown): val is Record<string, unknown>[] =>
  Array.isArray(val) && val.every((item) => isRecord(item));

const isErrorLike = (val: unknown): val is Error =>
  isRecord(val) && typeof val['name'] === 'string' && typeof val['message'] === 'string';

const getResponseData = (
  result: Record<string, unknown>,
  extraData: Record<string, unknown>,
  hasExtraData: boolean,
): BaseResponse['data'] => {
  const resultData = result['data'];
  if (isRecord(resultData)) {
    return { ...resultData, ...extraData };
  }
  if (isRecordArray(resultData)) {
    return resultData;
  }
  if (hasExtraData) {
    return extraData;
  }
  if (resultData === null) {
    return undefined;
  }
  return undefined;
};

const getResponseErrorAndSuccessAndCode = (
  result: Record<string, unknown>,
): {
  code: number;
  error: ErrorDetails | undefined;
  success: boolean;
} => {
  const err = result['error'];
  const hasError = err !== undefined && err !== null;

  const success = typeof result['success'] === 'boolean' ? result['success'] : !hasError;

  let code = typeof result['code'] === 'number' ? result['code'] : 200;
  if (hasError && result['code'] === undefined) {
    const { statusCode, code: errCode } = err as { statusCode?: number; code?: number };

    if (typeof statusCode === 'number') {
      code = statusCode;
    } else if (typeof errCode === 'number') {
      code = errCode;
    } else {
      code = 500;
    }
  }

  let error: ErrorDetails | undefined = undefined;
  if (hasError && (err instanceof Error || isErrorLike(err))) {
    error = {
      message: err.message,
      name: err.name,
      statusCode: code,
      ...(err.stack === undefined ? {} : { stack: err.stack }),
    };
  }

  return { code, error, success };
};

const createRouteHandlerImpl =
  <C extends new (ctx: ServiceContext, inputArgs?: InputArgs) => BaseService>(
    serviceClass: C,
    method: keyof C,
  ): RouteHandler =>
  async (params: RouteHandlerParams) => {
    try {
      const { ctx, input } = params as { ctx: ServiceContext; input?: unknown };

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

      const standardKeys = new Set(['code', 'data', 'message', 'sessionId', 'success', 'error']);
      const extraData: Record<string, unknown> = {};

      let hasExtraData = false;
      for (const key of Object.keys(result)) {
        if (!standardKeys.has(key)) {
          extraData[key] = result[key];
          hasExtraData = true;
        }
      }

      const responseData = getResponseData(result, extraData, hasExtraData);
      const { code, error, success } = getResponseErrorAndSuccessAndCode(result);

      const response: BaseResponse = {
        code,
        message:
          typeof result['message'] === 'string'
            ? result['message']
            : 'Request processed successfully',
        sessionId: ctx.req.locals.sessionId,
        success,
      };

      if (responseData) {
        response.data = responseData;
      }

      if (error) {
        response.error = error;
      }

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
export {
  assertIsInputArgs,
  assertIsServiceMethod,
  isRecordArray,
  isErrorLike,
  getResponseData,
  getResponseErrorAndSuccessAndCode,
  createRouteHandlerImpl,
  createRouteHandler,
};
