type InvokableFunction = {
  bivarianceHack(...args: unknown[]): unknown;
}['bivarianceHack'];

type ModuleExports = Record<string, unknown>;

interface ParameterInfo {
  name: string;
}

interface ParsedType {
  base?: string;
  itemType?: ParsedType | string;
  kind: 'array' | 'object' | 'primitive' | 'union';
  properties?: Record<string, ParsedType | string>;
  types?: (ParsedType | string)[];
  required?: boolean;
}

interface ParameterMetadata extends ParameterInfo {
  defaultValue?: boolean | number | string | undefined | unknown[] | Record<string, unknown>;
  description?: string | undefined;
  properties?: ParameterMetadata[] | undefined;
  required?: boolean | undefined;
  type: string | ParsedType | Record<string, unknown>;
}

interface ParsedParam {
  defaultValue?: string;
  name: string;
}

type ServiceConstructor = new (...args: unknown[]) => Record<string, unknown>;

export type {
  InvokableFunction,
  ModuleExports,
  ParameterInfo,
  ParameterMetadata,
  ParsedParam,
  ParsedType,
  ServiceConstructor,
};
