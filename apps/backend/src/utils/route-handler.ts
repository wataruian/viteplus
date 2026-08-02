import type {
  BaseResponse,
  InputArgs,
  RouteHandler,
  RouteHandlerParams,
  ServiceContext,
  ServiceMethod,
} from '../types/middlware';
import { invokeWithParsedArgs, tracer } from '@lightproject/common/utils';
import type { BaseService } from '../services/base';
import { isRecord } from '@lightproject/common/validators';
import { logger } from '@lightproject/common/logger';
import { randomUUID } from 'node:crypto';

const uuidv4 = () => randomUUID();

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
    return null;
  }
  return undefined;
};

const getResponseErrorAndSuccessAndCode = (
  result: Record<string, unknown>,
): {
  code: number;
  error: BaseResponse['error'];
  success: boolean;
} => {
  const hasError = result['error'] !== undefined && result['error'] !== null;
  let responseSuccess = typeof result['success'] === 'boolean' ? result['success'] : true;
  if (hasError && result['success'] === undefined) {
    responseSuccess = false;
  }

  let responseCode = typeof result['code'] === 'number' ? result['code'] : 200;
  if (hasError && result['code'] === undefined) {
    const errObj = result['error'];
    if (isRecord(errObj)) {
      if (typeof errObj['statusCode'] === 'number') {
        responseCode = errObj['statusCode'];
      } else if (typeof errObj['code'] === 'number') {
        responseCode = errObj['code'];
      } else {
        responseCode = 500;
      }
    } else {
      responseCode = 500;
    }
  }

  let errorObj: BaseResponse['error'] = undefined;
  if (hasError) {
    const err = result['error'];
    if (err instanceof Error) {
      errorObj = err;
    } else if (isErrorLike(err)) {
      errorObj = err;
    } else if (err === null) {
      errorObj = null;
    }
  }

  return {
    code: responseCode,
    error: errorObj,
    success: responseSuccess,
  };
};

const createRouteHandlerImpl =
  <C extends new (ctx: ServiceContext, inputArgs?: InputArgs) => BaseService>(
    serviceClass: C,
    method: keyof C,
  ): RouteHandler =>
  async (params: RouteHandlerParams) => {
    const { ctx, input } = params as { ctx: ServiceContext; input?: unknown };

    const sessionId = ctx.req.locals.sessionId ?? uuidv4();
    const { requestType } = ctx.req.locals.metadata;

    const span = tracer.startSpan(`${requestType.toLowerCase()}.start`, {
      attributes: {
        class: serviceClass.name,
        function: String(method),
        method: ctx.req.method,
        path: ctx.req.locals.metadata.url,
        requestType,
        sessionId,
      },
    });

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
        sessionId:
          typeof result['sessionId'] === 'string'
            ? result['sessionId']
            : (ctx.req.locals.sessionId ?? undefined),
        success,
      };

      if (responseData !== null && responseData !== undefined) {
        response.data = responseData;
      }

      if (error !== null && error !== undefined) {
        response.error = error;
      }

      span.setAttribute('success', true).end();

      return response;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setAttribute('success', false).end();

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
  getResponseData,
  getResponseErrorAndSuccessAndCode,
  createRouteHandlerImpl,
  createRouteHandler,
};
