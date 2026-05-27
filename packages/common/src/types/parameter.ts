type InvokableFunction = {
  bivarianceHack(...args: unknown[]): unknown;
}['bivarianceHack'];

type ModuleExports = Record<string, unknown>;

interface ParameterInfo {
  name: string;
}

interface ParameterMetadata extends ParameterInfo {
  defaultValue?: boolean | number | string | undefined | unknown[];
  description?: string | undefined;
  properties?: ParameterMetadata[] | undefined;
  required?: boolean | undefined;
  type: string;
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
  ServiceConstructor,
};
