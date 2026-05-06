import type { TRPCProcedureType } from '@trpc/server';

import type { AppRouterPaths } from '../utils/trpc-router';
import type { HttpMethod } from './middlware';

export interface HttpTestCase {
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

export interface MakeHttpRequestOptions {
  endpoint: string;
  env?: TestEnvironment;
  input?: Record<string, unknown>;
  ip?: string;
  method?: HttpMethod;
}

export interface MakeTrcpRequestOptions {
  env?: TestEnvironment;
  input?: Record<string, unknown>;
  ip?: string;
  method?: HttpMethod;
  path?: 'test.unknown' | AppRouterPaths;
  type: TRPCProcedureType;
}

export type TestEnvironment = 'other-test' | 'test';

export interface TrpcTestCase {
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
  path: 'test.unknown' | AppRouterPaths;
  type: TRPCProcedureType;
}
