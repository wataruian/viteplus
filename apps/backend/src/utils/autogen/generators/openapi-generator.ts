import type { ParameterMetadata, ParsedType } from '@lightproject/common/types';
import type { RouteInfo } from '../types';
import { apiEndpoint } from '@lightproject/common/configs';

interface OpenApiOperation {
  description?: string;
  parameters?: OpenApiParameter[];
  requestBody?: {
    content: Record<string, { schema: OpenApiSchema }>;
    required?: boolean;
  };
  responses: Record<string, OpenApiResponse>;
  summary?: string;
  tags?: string[];
}

interface OpenApiParameter {
  description?: string;
  in: 'cookie' | 'header' | 'path' | 'query';
  name: string;
  required?: boolean;
  schema: OpenApiSchema;
}

interface OpenApiResponse {
  content?: Record<string, { schema: OpenApiSchema }>;
  description: string;
}

interface OpenApiSchema {
  allOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
  default?: unknown;
  description?: string;
  example?: unknown;
  format?: string;
  items?: OpenApiSchema;
  oneOf?: OpenApiSchema[];
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  type?: string;
}

interface OpenApiSpec {
  components?: {
    schemas?: Record<string, OpenApiSchema>;
  };
  info: {
    description?: string;
    title: string;
    version: string;
  };
  openapi: string;
  paths: Record<string, Record<string, OpenApiOperation>>;
  servers: {
    description?: string;
    url: string;
  }[];
}

const exampleValues = {
  booleanArray: [true, false],
  booleanValue: true,
  httpStatusBadRequest: 400,
  httpStatusInternalError: 500,
  numberArray: [123, 456],
  numberValue: 123,
  stringArray: ['ABC', 'DEF'],
  stringValue: 'ABC',
} as const;

const getActionDescription = (methodName: string, service: string): string | undefined => {
  const GetPrefixLength = 3;
  const CreateAddPrefixLength = 6;
  const UpdateEditPrefixLength = 6;
  const DeleteRemovePrefixLength = 6;

  if (methodName.startsWith('get')) {
    const resource = methodName.slice(GetPrefixLength);
    return `Retrieve ${resource.toLowerCase()} data from ${service}`;
  }

  if (methodName.startsWith('create') || methodName.startsWith('add')) {
    const resource = methodName.slice(CreateAddPrefixLength);
    return `Create new ${resource.toLowerCase()} in ${service}`;
  }

  if (methodName.startsWith('update') || methodName.startsWith('edit')) {
    const resource = methodName.slice(UpdateEditPrefixLength);
    return `Update existing ${resource.toLowerCase()} in ${service}`;
  }

  if (methodName.startsWith('delete') || methodName.startsWith('remove')) {
    const resource = methodName.slice(DeleteRemovePrefixLength);
    return `Delete ${resource.toLowerCase()} from ${service}`;
  }

  return undefined;
};

const getSpecialDescription = (methodName: string): string | undefined => {
  if (methodName.includes('Success')) {
    return `Execute ${methodName.replace('Success', '')} operation successfully`;
  }

  if (methodName.includes('Fail')) {
    return `Simulate ${methodName.replace('Fail', '')} operation failure for testing`;
  }

  if (methodName.startsWith('hello')) {
    return 'Generate personalized greeting message';
  }

  if (methodName.includes('Params')) {
    return 'Test and validate various parameter types and structures';
  }

  const exactMatches: Record<string, string> = {
    mixedParams: 'Process mixed parameter types including primitives, objects, and arrays',
    objectDestructured: 'Process destructured object parameters',
    objectOnly: 'Process object-only parameters with optional properties',
    primitivesAndArray: 'Process primitive parameters and array data',
  };

  return exactMatches[methodName];
};

const generateMethodDescription = (
  methodName?: string,
  serviceClass?: string,
): string | undefined => {
  if (
    methodName === undefined ||
    serviceClass === undefined ||
    methodName === '' ||
    serviceClass === ''
  ) {
    return undefined;
  }

  const service = serviceClass.replace('Service', '');

  if (methodName === 'root') {
    return `Get ${service} service status and basic information`;
  }

  const actionDesc = getActionDescription(methodName, service);
  if (actionDesc !== undefined) {
    return actionDesc;
  }

  return getSpecialDescription(methodName);
};

const getDefaultResponseSchema = (): OpenApiSchema => ({
  properties: {
    data: {
      description: 'Response data payload',
      type: 'object',
    },
    message: {
      description: 'Response message',
      type: 'string',
    },
    success: {
      description: 'Operation success indicator',
      type: 'boolean',
    },
  },
  type: 'object',
});

const generateOperationTags = (route: RouteInfo): string[] => [route.requestType];

const generateOperationSummary = (route: RouteInfo): string => {
  const serviceName = route.serviceClass?.replace('Service', '') ?? 'Unknown';
  const methodName = route.serviceMethod ?? 'unknown';

  if (route.requestType === 'tRPC') {
    const procedureType = route.type === 'mutation' ? 'Mutation' : 'Query';
    return `${serviceName} ${methodName} (${procedureType})`;
  }

  return `${serviceName} ${methodName}`;
};

const parseObjectProperties = (content: string): string[] => {
  const properties: string[] = [];
  let current = '';
  let braceDepth = 0;

  for (const char of content) {
    if (char === '{') {
      braceDepth += 1;
      current += char;
    } else if (char === '}') {
      braceDepth -= 1;
      current += char;
    } else if (char === ';' && braceDepth === 0) {
      if (current.trim()) {
        properties.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    properties.push(current.trim());
  }

  return properties;
};

const isParsedType = (val: unknown): val is ParsedType =>
  typeof val === 'object' && val !== null && 'kind' in val;

const parsedTypeToString = (parsed: ParsedType | string | Record<string, unknown>): string => {
  if (typeof parsed === 'string') {
    return parsed;
  }

  const parsedVal = parsed as unknown;
  if (typeof parsedVal !== 'object' || parsedVal === null) {
    return 'unknown';
  }

  if (isParsedType(parsedVal)) {
    switch (parsedVal.kind) {
      case 'primitive': {
        return parsedVal.base ?? 'unknown';
      }
      case 'array': {
        const itemType = parsedTypeToString(parsedVal.itemType ?? 'unknown');
        return `${itemType}[]`;
      }
      case 'union': {
        const types = (parsedVal.types ?? []).map((t) => parsedTypeToString(t));
        return types.join(' | ');
      }
      case 'object': {
        const props = Object.entries(parsedVal.properties ?? {}).map(([k, v]) => {
          const isOptional = isParsedType(v) && v.required === false;
          return `${k}${isOptional ? '?' : ''}: ${parsedTypeToString(v)}`;
        });
        return `{ ${props.join('; ')} }`;
      }
      default: {
        return 'unknown';
      }
    }
  }

  return 'unknown';
};

const convertTypeToSchema = (
  type: string | ParsedType | Record<string, unknown>,
  defaultValue?: unknown,
): OpenApiSchema => {
  const typeString = parsedTypeToString(type);
  const schema: OpenApiSchema = {};

  if (defaultValue !== undefined) {
    schema.default = defaultValue;
  }

  if (typeString.endsWith('[]')) {
    const itemType = typeString.slice(0, -2);
    return {
      default: defaultValue,
      items: convertTypeToSchema(itemType),
      type: 'array',
    };
  }

  if (typeString.includes(' | ')) {
    const unionTypes = typeString.split(' | ').map((t) => t.trim());
    const nonUndefinedTypes = unionTypes.filter((t) => t !== 'undefined');

    if (nonUndefinedTypes.length === 1) {
      const [singleType] = nonUndefinedTypes;
      if (singleType) {
        return convertTypeToSchema(singleType, defaultValue);
      }
    }

    return {
      default: defaultValue,
      oneOf: nonUndefinedTypes.map((t) => convertTypeToSchema(t)),
    };
  }

  if (typeString.startsWith('{') && typeString.endsWith('}')) {
    const objectSchema: OpenApiSchema = {
      default: defaultValue,
      properties: {},
      type: 'object',
    };

    const content = typeString.slice(1, -1).trim(); // Remove { }

    if (!content) {
      return objectSchema;
    }

    const required: string[] = [];
    const properties: Record<string, OpenApiSchema> = {};

    const props = parseObjectProperties(content);

    for (const prop of props) {
      const colonIndex = prop.indexOf(':');
      if (colonIndex === -1) {
        continue;
      }

      const propName = prop.slice(0, colonIndex).trim();
      const propType = prop.slice(colonIndex + 1).trim();

      const isOptional = propName.endsWith('?');
      const cleanPropName = isOptional ? propName.slice(0, -1).trim() : propName;

      properties[cleanPropName] = convertTypeToSchema(propType);

      if (!isOptional) {
        required.push(cleanPropName);
      }
    }

    objectSchema.properties = properties;
    if (required.length > 0) {
      objectSchema.required = required;
    }

    return objectSchema;
  }

  switch (typeString) {
    case 'any':
    case 'unknown': {
      return { default: defaultValue, description: 'Any value' };
    }
    case 'boolean': {
      return { default: defaultValue, type: 'boolean' };
    }
    case 'number': {
      return { default: defaultValue, type: 'number' };
    }
    case 'string': {
      return { default: defaultValue, type: 'string' };
    }
    default: {
      return {
        default: defaultValue,
        description: `Type: ${typeString}`,
        type: 'string',
      };
    }
  }
};

const formatParsedTypeForDescription = (parsed: unknown, indent = 0): string => {
  if (isParsedType(parsed)) {
    switch (parsed.kind) {
      case 'primitive': {
        return parsed.base ?? 'unknown';
      }
      case 'array': {
        const item = formatParsedTypeForDescription(parsed.itemType, indent);
        return `array<${item}>`;
      }
      case 'union': {
        const types = (parsed.types ?? []).map((t) => formatParsedTypeForDescription(t, indent));
        return types.join(' | ');
      }
      case 'object': {
        const properties = parsed.properties ?? {};
        const entries = Object.entries(properties);
        if (entries.length === 0) {
          return '{}';
        }
        const currentIndent = '  '.repeat(indent);
        const nextIndent = '  '.repeat(indent + 1);

        const props = entries.map(([k, v]) => {
          const isOptional = isParsedType(v) && v.required === false;
          const formattedVal = formatParsedTypeForDescription(v, indent + 1);
          return `${nextIndent}${k}${isOptional ? '?' : ''}: ${formattedVal};`;
        });

        return `{\n${props.join('\n')}\n${currentIndent}}`;
      }
      default: {
        return 'unknown';
      }
    }
  }

  if (typeof parsed === 'string') {
    return parsed;
  }

  return 'unknown';
};

const getParameterTypeDescription = (
  type: ParsedType | string | Record<string, unknown>,
): string => {
  const formatted = formatParsedTypeForDescription(type);
  if (formatted.includes('\n')) {
    return `\`\`\`typescript\n${formatted}\n\`\`\``;
  }
  return `\`${formatted}\``;
};

const convertToQueryParameter = (param: ParameterMetadata): OpenApiParameter => {
  const result: OpenApiParameter = {
    description: getParameterTypeDescription(param.type),
    in: 'query',
    name: param.name,
    required: param.required ?? false,
    schema: { type: 'string' },
  };
  return result;
};

const convertParametersToRequestBodySchema = (params: ParameterMetadata[]): OpenApiSchema => {
  const properties: Record<string, OpenApiSchema> = {};
  const required: string[] = [];

  for (const param of params) {
    properties[param.name] = convertTypeToSchema(param.type, param.defaultValue);

    if (param.required !== undefined && param.required) {
      required.push(param.name);
    }
  }

  const schema: OpenApiSchema = {
    properties,
    type: 'object',
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
};

const generateEnhancedResponseSchema = (methodName?: string): OpenApiSchema => {
  if (methodName === undefined || methodName === '') {
    return getDefaultResponseSchema();
  }

  if (methodName === 'root') {
    return {
      properties: {
        message: {
          description: 'Service status message',
          example: 'OK',
          type: 'string',
        },
      },
      required: ['message'],
      type: 'object',
    };
  }

  if (methodName.includes('Success')) {
    return {
      properties: {
        message: {
          description: 'Success confirmation message',
          example: 'Operation completed successfully',
          type: 'string',
        },
      },
      required: ['message'],
      type: 'object',
    };
  }

  if (methodName.startsWith('hello')) {
    return {
      properties: {
        message: {
          description: 'Personalized greeting message',
          example: 'Hello, John Doe!',
          type: 'string',
        },
      },
      required: ['message'],
      type: 'object',
    };
  }

  if (
    methodName.includes('Params') ||
    methodName === 'mixedParams' ||
    methodName === 'objectOnly' ||
    methodName === 'objectDestructured' ||
    methodName === 'primitivesAndArray'
  ) {
    return {
      properties: {
        data: {
          description: 'Processed input parameters and their values',
          properties: {},
          type: 'object',
        },
        message: {
          description: 'Processing confirmation message',
          example: 'Parameters processed successfully',
          type: 'string',
        },
      },
      required: ['message'],
      type: 'object',
    };
  }

  if (methodName === '_checkParams') {
    return {
      properties: {
        booleanArrayOutput: {
          example: exampleValues.booleanArray,
          items: { type: 'boolean' },
          type: 'array',
        },
        booleanOutput: {
          example: exampleValues.booleanValue,
          type: 'boolean',
        },
        numberArrayOutput: {
          example: exampleValues.numberArray,
          items: { type: 'number' },
          type: 'array',
        },
        numberOutput: {
          example: exampleValues.numberValue,
          type: 'number',
        },
        objectBooleanArrayOutput: {
          properties: {
            booleanArray: {
              items: { type: 'boolean' },
              type: 'array',
            },
          },
          type: 'object',
        },
        objectBooleanOutput: {
          properties: {
            boolean: { type: 'boolean' },
          },
          type: 'object',
        },
        objectMultipleOutput: {
          description: 'Complex nested object with multiple data types',
          type: 'object',
        },
        objectNumberArrayOutput: {
          properties: {
            numberArray: {
              items: { type: 'number' },
              type: 'array',
            },
          },
          type: 'object',
        },
        objectNumberOutput: {
          properties: {
            number: { type: 'number' },
          },
          type: 'object',
        },
        objectStringArrayOutput: {
          properties: {
            stringArray: {
              items: { type: 'string' },
              type: 'array',
            },
          },
          type: 'object',
        },
        objectStringOutput: {
          properties: {
            string: { type: 'string' },
          },
          type: 'object',
        },
        stringArrayOutput: {
          example: exampleValues.stringArray,
          items: { type: 'string' },
          type: 'array',
        },
        stringOutput: {
          example: exampleValues.stringValue,
          type: 'string',
        },
      },
      type: 'object',
    };
  }

  return getDefaultResponseSchema();
};

const escapeHtml = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const formatOpenApiSchemaForDescription = (schema: OpenApiSchema, indent = 0): string => {
  if (schema.type === 'array' && schema.items !== undefined) {
    const item = formatOpenApiSchemaForDescription(schema.items, indent);
    return `array<${item}>`;
  }

  if (schema.type === 'object') {
    if (schema.properties !== undefined) {
      const entries = Object.entries(schema.properties);
      if (entries.length === 0) {
        return '{}';
      }
      const currentIndent = '  '.repeat(indent);
      const nextIndent = '  '.repeat(indent + 1);

      const props = entries.map(([k, v]) => {
        const isRequired = schema.required?.includes(k) ?? false;
        const formattedVal = formatOpenApiSchemaForDescription(v, indent + 1);
        return `${nextIndent}${k}${isRequired ? '' : '?'}: ${formattedVal};`;
      });

      return `{\n${props.join('\n')}\n${currentIndent}}`;
    }
    return 'object';
  }

  return schema.type ?? 'unknown';
};

const generateResponses = (route: RouteInfo): Record<string, OpenApiResponse> => {
  const successSchema =
    route.output === undefined
      ? generateEnhancedResponseSchema(route.serviceMethod)
      : convertTypeToSchema(route.output.type);

  const hasFailInPath = route.path.toLowerCase().includes('fail');
  const hasFailInMethod =
    route.serviceMethod === undefined ? false : route.serviceMethod.toLowerCase().includes('fail');
  const isFailure = hasFailInPath || hasFailInMethod;
  const statusCode = isFailure ? '500' : '200';
  const descriptionLabel = isFailure ? 'Failed response' : 'Successful response';

  let responseDescription = descriptionLabel;
  if (successSchema.properties !== undefined) {
    const entries = Object.entries(successSchema.properties);
    if (entries.length > 0) {
      const rows = ['| Name | Type |', '| --- | --- |'];
      for (const [name, propSchema] of entries) {
        const formatted = formatOpenApiSchemaForDescription(propSchema);
        const escaped = escapeHtml(formatted);
        const cellType = formatted.includes('\n')
          ? `<pre><code>${escaped.replaceAll('\n', '<br>').replaceAll(' ', '&nbsp;')}</code></pre>`
          : `\`${formatted}\``;
        rows.push(`| ${name} | ${cellType} |`);
      }
      responseDescription = `${descriptionLabel}\n\n${rows.join('\n')}`;
    }
  }

  return {
    [statusCode]: {
      content: {
        'application/json': {
          schema: successSchema,
        },
      },
      description: responseDescription,
    },
  };
};

const generateOperationDescription = (route: RouteInfo): string => {
  const enhancedDescription = generateMethodDescription(route.serviceMethod, route.serviceClass);

  if (enhancedDescription !== undefined && enhancedDescription !== '') {
    return enhancedDescription;
  }

  const parts: string[] = [];

  if (
    route.serviceClass !== undefined &&
    route.serviceClass !== '' &&
    route.serviceMethod !== undefined &&
    route.serviceMethod !== ''
  ) {
    parts.push(`Calls ${route.serviceClass}.${route.serviceMethod}()`);
  }

  if (route.requestType === 'tRPC') {
    parts.push(`tRPC ${route.type ?? 'query'} procedure`);
  } else {
    parts.push('HTTP endpoint');
  }

  return parts.join(' - ');
};

const extractPathParameters = (path: string): string[] => {
  const colonMatches = [...path.matchAll(/:(?<paramName>[a-zA-Z0-9_]+)/gu)].map(
    (m) => m.groups?.['paramName'] ?? '',
  );
  const braceMatches = [...path.matchAll(/\{(?<paramName>[a-zA-Z0-9_]+)\}/gu)].map(
    (m) => m.groups?.['paramName'] ?? '',
  );
  return [...new Set([...colonMatches, ...braceMatches])];
};

const generateOperation = (route: RouteInfo): OpenApiOperation => {
  const operation: OpenApiOperation = {
    description: generateOperationDescription(route),
    responses: generateResponses(route),
    summary: generateOperationSummary(route),
    tags: generateOperationTags(route),
  };

  const pathParams = route.path ? extractPathParameters(route.path) : [];

  if (route.input !== undefined && route.input.length > 0) {
    const method = (route.method ?? 'get').toLowerCase();
    const pathInputParams = route.input.filter((p) => pathParams.includes(p.name));
    const otherInputParams = route.input.filter((p) => !pathParams.includes(p.name));

    const parameters: OpenApiParameter[] = [];

    for (const param of pathInputParams) {
      const pathParam: OpenApiParameter = {
        in: 'path',
        name: param.name,
        required: true,
        schema: convertTypeToSchema(param.type),
      };
      if (param.description !== undefined) {
        pathParam.description = param.description;
      }
      parameters.push(pathParam);
    }

    for (const param of otherInputParams) {
      parameters.push(convertToQueryParameter(param));
    }

    if (!['delete', 'get', 'head'].includes(method) && otherInputParams.length > 0) {
      operation.requestBody = {
        content: {
          'application/json': {
            schema: convertParametersToRequestBodySchema(otherInputParams),
          },
        },
        required: otherInputParams.some((p) => p.required !== undefined && p.required),
      };
    }

    if (parameters.length > 0) {
      operation.parameters = parameters;
    }
  } else if (pathParams.length > 0) {
    operation.parameters = pathParams.map((name) => ({
      in: 'path',
      name,
      required: true,
      schema: { type: 'string' },
    }));
  }

  return operation;
};

const groupRoutesByPath = (routes: RouteInfo[]): Record<string, RouteInfo[]> => {
  const groups: Record<string, RouteInfo[]> = {};

  for (const route of routes) {
    let normalizedPath = route.path || '/';

    if (!normalizedPath.startsWith('/')) {
      normalizedPath = `/${normalizedPath}`;
    }

    if (route.requestType === 'HTTP' && !normalizedPath.startsWith(apiEndpoint)) {
      normalizedPath = normalizedPath === '/' ? apiEndpoint : `${apiEndpoint}${normalizedPath}`;
    }

    // Convert Express colon parameters to OpenAPI curly brace parameters
    normalizedPath = normalizedPath.replaceAll(/:(?<paramName>[a-zA-Z0-9_]+)/gu, '{$<paramName>}');

    groups[normalizedPath] ??= [];

    groups[normalizedPath]?.push(route);
  }

  return groups;
};

const generateOpenApiSpec = (
  routes: RouteInfo[],
  options: {
    description?: string;
    serverUrl?: string;
    title?: string;
    version?: string;
  } = {},
): OpenApiSpec => {
  const {
    description = 'Auto-generated API documentation from route discovery',
    serverUrl = 'http://localhost:3000',
    title = 'Pancake API',
    version = '1.0.0',
  } = options;

  const spec: OpenApiSpec = {
    components: {
      schemas: {},
    },
    info: {
      description,
      title,
      version,
    },
    openapi: '3.0.3',
    paths: {},
    servers: [
      {
        description: 'Development server',
        url: serverUrl,
      },
    ],
  };

  const pathGroups = groupRoutesByPath(routes);

  for (const [path, pathRoutes] of Object.entries(pathGroups)) {
    spec.paths[path] = {};

    for (const route of pathRoutes) {
      const method = (route.method ?? 'get').toLowerCase();
      const operation = generateOperation(route);

      spec.paths[path][method] = operation;
    }
  }

  return spec;
};

export type { OpenApiOperation, OpenApiParameter, OpenApiResponse, OpenApiSchema, OpenApiSpec };
export {
  isParsedType,
  parsedTypeToString,
  exampleValues,
  getActionDescription,
  getSpecialDescription,
  generateMethodDescription,
  getDefaultResponseSchema,
  generateOperationTags,
  generateOperationSummary,
  parseObjectProperties,
  convertTypeToSchema,
  convertToQueryParameter,
  convertParametersToRequestBodySchema,
  generateEnhancedResponseSchema,
  generateResponses,
  generateOperationDescription,
  generateOperation,
  groupRoutesByPath,
  generateOpenApiSpec,
};
