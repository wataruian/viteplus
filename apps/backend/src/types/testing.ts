import type { AppRouterPaths } from '../utils/trpc-router';
import type { HttpMethod } from './middlware';
import type { TRPCProcedureType } from '@trpc/server';

interface HttpTestCase {
  description?: string;
  endpoint: string;
  env?: TestEnvironment;
  expected: {
    code: number;
    data?: unknown;
    message?: string;
    success: boolean;
  };
  input?: null | Record<string, unknown>;
  method: HttpMethod;
}

interface MakeHttpRequestOptions {
  endpoint: string;
  env?: TestEnvironment;
  input?: Record<string, unknown>;
  ip?: string;
  method?: HttpMethod;
}

interface MakeTrcpRequestOptions {
  env?: TestEnvironment;
  input?: Record<string, unknown>;
  ip?: string;
  method?: HttpMethod;
  path: AppRouterPaths | 'test.unknown';
  type: TRPCProcedureType;
}

type TestEnvironment = 'other-test' | 'test';

interface TrpcTestCase {
  description?: string;
  endpoint?: string;
  env?: TestEnvironment;
  expected: {
    code: number;
    data?: unknown;
    message?: string | undefined;
    success: boolean;
    trpcError?: string | undefined;
  };
  input?: null | Record<string, unknown> | undefined;
  path: AppRouterPaths | 'test.unknown';
  type: TRPCProcedureType;
}

export type {
  HttpTestCase,
  MakeHttpRequestOptions,
  MakeTrcpRequestOptions,
  TestEnvironment,
  TrpcTestCase,
};
