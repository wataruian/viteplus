import type { ParameterMetadata } from '@lightproject/common/types';

interface RouteHandlerInfo {
  handlerFilePath: string;
  path: string;
  procedureType?: 'mutation' | 'query' | undefined;
  serviceClass: string | undefined;
  serviceMethod: string | undefined;
}

interface RouteInfo {
  handlerFilePath?: string | undefined;
  input?: ParameterMetadata[] | undefined;
  method?: string | undefined;
  output?: ParameterMetadata[] | undefined;
  path: string;
  requestType: string;
  serviceClass?: string | undefined;
  serviceFilePath?: string | undefined;
  serviceMethod?: string | undefined;
  type?: string | undefined;
}

interface ServiceMetadata {
  input: ParameterMetadata[] | undefined;
  output: ParameterMetadata[] | undefined;
  serviceFilePath: string | undefined;
}

export type { RouteHandlerInfo, RouteInfo, ServiceMetadata };
