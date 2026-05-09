interface ParameterInfo {
  name: string;
}

interface ParameterMetadata extends ParameterInfo {
  defaultValue?: boolean | number | string | undefined | unknown[];
  description?: string | undefined;
  properties?: ParameterMetadata[] | undefined;
  required: boolean;
  type: string;
}

export type { ParameterInfo, ParameterMetadata };
