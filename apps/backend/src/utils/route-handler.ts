import { logger } from '@lightproject/common/logger';
import type { JsonValue } from '@lightproject/common/utils';
import { isRecord, isRecordArray } from '@lightproject/common/validators';
import { z } from 'zod';

import type {
  BaseResponse,
  ErrorDetails,
  InputArgs,
  RouteHandler,
  RouteHandlerParams,
  ServiceContext,
} from '../middlewares/initialize-request';
import type { BaseService } from '../services/base';

type ServiceMethod = <TInput>(
  input?: TInput,
  ...additionalInputs: TInput[]
) => JsonValue | Promise<JsonValue>;

const assertIsServiceMethod: (val: unknown) => asserts val is ServiceMethod = (_val: unknown) => {};

const getResponseData = (
  result: Record<string, unknown>,
  extraData: Record<string, unknown>,
  hasExtraData: boolean,
): unknown => {
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
  return resultData;
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
    const { statusCode, code: errCode } = isRecord(err)
      ? err
      : { code: undefined, statusCode: undefined };

    if (typeof statusCode === 'number') {
      code = statusCode;
    } else if (typeof errCode === 'number') {
      code = errCode;
    } else {
      code = 500;
    }
  }

  let error: ErrorDetails | undefined = undefined;
  if (hasError && err instanceof Error) {
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
    schemas?: {
      input?: z.ZodType;
      output?: z.ZodType;
    },
  ): RouteHandler =>
  async <TInput>(params: RouteHandlerParams<TInput>) => {
    try {
      const { ctx, input: rawInput } = params;
      const isTrpc = 'path' in params && 'batchIndex' in params;

      const input = !isTrpc && schemas?.input ? schemas.input.parse(rawInput) : rawInput;

      const serviceMethod = Reflect.get(serviceClass, String(method));

      if (typeof serviceMethod !== 'function') {
        throw new TypeError(`Method ${String(method)} not found on service ${serviceClass.name}`);
      }

      assertIsServiceMethod(serviceMethod);
      const rawResult: unknown = await serviceMethod(input);
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

      const response: BaseResponse<unknown> = {
        code,
        message:
          typeof result['message'] === 'string'
            ? result['message']
            : 'Request processed successfully',
        sessionId: ctx.req.locals.sessionId,
        success,
      };

      let parsedData = responseData;
      if (!isTrpc && schemas?.output && parsedData !== undefined) {
        parsedData = schemas.output.parse(parsedData);
      }

      if (parsedData !== undefined) {
        response.data = parsedData;
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

      if (error instanceof z.ZodError) {
        return {
          code: 400,
          error: {
            message: 'Validation failed',
            name: 'ZodError',
            statusCode: 400,
          },
          message: error.message,
          sessionId: (params as { ctx: ServiceContext }).ctx.req.locals.sessionId,
          success: false,
        };
      }

      throw error;
    }
  };

const createRouteHandler = createRouteHandlerImpl;

const createBaseResponseSchema = <T extends z.ZodType>(dataSchema?: T) =>
  z.object({
    code: z.number(),
    data: dataSchema ? dataSchema.optional() : z.any().optional(),
    error: z
      .object({
        message: z.string(),
        name: z.string(),
        stack: z.string().optional(),
        statusCode: z.number(),
      })
      .optional(),
    message: z.string().optional(),
    sessionId: z.string(),
    success: z.boolean(),
  });

export {
  assertIsServiceMethod,
  createBaseResponseSchema,
  createRouteHandler,
  createRouteHandlerImpl,
  getResponseData,
  getResponseErrorAndSuccessAndCode,
};
