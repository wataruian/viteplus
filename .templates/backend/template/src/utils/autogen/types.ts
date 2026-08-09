interface ParsedType {
  base?: string;
  itemType?: ParsedType | string;
  kind: 'array' | 'object' | 'primitive' | 'union';
  properties?: Record<string, ParsedType | string>;
  types?: (ParsedType | string)[];
  required?: boolean;
}

interface ParameterMetadata {
  name: string;
  defaultValue?: boolean | number | string | undefined | unknown[] | Record<string, unknown>;
  description?: string | undefined;
  properties?: ParameterMetadata[] | undefined;
  required?: boolean | undefined;
  type: string | ParsedType | Record<string, unknown>;
}

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
  output?: ParameterMetadata | undefined;
  path: string;
  requestType: string;
  serviceClass?: string | undefined;
  serviceFilePath?: string | undefined;
  serviceMethod?: string | undefined;
  type?: string | undefined;
}

interface ServiceMetadata {
  input: ParameterMetadata[] | undefined;
  output: ParameterMetadata | undefined;
  serviceFilePath: string | undefined;
}

export type { ParameterMetadata, ParsedType, RouteHandlerInfo, RouteInfo, ServiceMetadata };
