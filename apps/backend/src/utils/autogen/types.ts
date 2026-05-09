import type { ParameterMetadata } from '@lightproject/common';

/**
 * Extracted route handler information
 */
export interface RouteHandlerInfo {
  handlerFilePath: string;
  path: string;
  procedureType?: 'mutation' | 'query' | undefined;
  serviceClass: string | undefined;
  serviceMethod: string | undefined;
}

/**
 * Represents a discovered API route with its metadata
 */
export interface RouteInfo {
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

/**
 * Service metadata extracted from route handlers
 */
export interface ServiceMetadata {
  input: ParameterMetadata[] | undefined;
  serviceFilePath: string | undefined;
}
