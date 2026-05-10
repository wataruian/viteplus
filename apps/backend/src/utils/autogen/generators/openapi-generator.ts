import type { ParameterMetadata } from '@lightproject/common/types';
import type { RouteInfo } from '../types';

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

const generateMethodDescription = (
  methodName?: string,
  serviceClass?: string,
): string | undefined => {
  if (!(methodName && serviceClass)) {
    return;
  }

  const service = serviceClass.replace('Service', '');

  const GetPrefixLength = 3;
  const CreateAddPrefixLength = 6;
  const UpdateEditPrefixLength = 6;
  const DeleteRemovePrefixLength = 6;

  if (methodName === 'root') {
    return `Get ${service} service status and basic information`;
  }

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

  if (methodName === 'mixedParams') {
    return 'Process mixed parameter types including primitives, objects, and arrays';
  }

  if (methodName === 'objectOnly') {
    return 'Process object-only parameters with optional properties';
  }

  if (methodName === 'objectDestructured') {
    return 'Process destructured object parameters';
  }

  if (methodName === 'primitivesAndArray') {
    return 'Process primitive parameters and array data';
  }

  return undefined;
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

const generateOperationTags = (route: RouteInfo): string[] => {
  const tags: string[] = [];

  if (route.serviceClass) {
    tags.push(route.serviceClass.replace('Service', ''));
  }

  tags.push(route.requestType);

  return tags;
};

const generateOperationSummary = (route: RouteInfo): string => {
  const serviceName = route.serviceClass?.replace('Service', '') || 'Unknown';
  const methodName = route.serviceMethod || 'unknown';

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
    } else if (char === '}') {
      braceDepth -= 1;
    } else if (char === ';' && braceDepth === 0) {
      if (current.trim()) {
        properties.push(current.trim());
      }
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    properties.push(current.trim());
  }

  return properties;
};

const convertTypeToSchema = (type: string, defaultValue?: unknown): OpenApiSchema => {
  const schema: OpenApiSchema = {};

  if (defaultValue !== undefined) {
    schema.default = defaultValue;
  }

  if (type.endsWith('[]')) {
    const itemType = type.slice(0, -2);
    return {
      default: defaultValue,
      items: convertTypeToSchema(itemType),
      type: 'array',
    };
  }

  if (type.includes(' | ')) {
    const unionTypes = type.split(' | ').map((t) => t.trim());
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

  if (type.startsWith('{') && type.endsWith('}')) {
    const objectSchema: OpenApiSchema = {
      default: defaultValue,
      properties: {},
      type: 'object',
    };

    const content = type.slice(1, -1).trim(); // Remove { }

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

  switch (type) {
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
        description: `Type: ${type}`,
        type: 'string',
      };
    }
  }
};

const convertToQueryParameter = (param: ParameterMetadata): OpenApiParameter => ({
  in: 'query',
  name: param.name,
  required: param.required,
  schema: convertTypeToSchema(param.type, param.defaultValue),
});

const convertParametersToRequestBodySchema = (params: ParameterMetadata[]): OpenApiSchema => {
  const properties: Record<string, OpenApiSchema> = {};
  const required: string[] = [];

  for (const param of params) {
    properties[param.name] = convertTypeToSchema(param.type, param.defaultValue);

    if (param.required) {
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
  if (!methodName) {
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

const generateResponses = (route: RouteInfo): Record<string, OpenApiResponse> => {
  const successSchema = generateEnhancedResponseSchema(route.serviceMethod);

  return {
    '200': {
      content: {
        'application/json': {
          schema: successSchema,
        },
      },
      description: 'Successful response',
    },
    '400': {
      content: {
        'application/json': {
          schema: {
            properties: {
              error: {
                description: 'Error message',
                type: 'string',
              },
              statusCode: {
                description: 'HTTP status code',
                example: exampleValues.httpStatusBadRequest,
                type: 'number',
              },
            },
            required: ['error', 'statusCode'],
            type: 'object',
          },
        },
      },
      description: 'Bad request - Invalid input parameters',
    },
    '500': {
      content: {
        'application/json': {
          schema: {
            properties: {
              error: {
                description: 'Internal error message',
                type: 'string',
              },
              statusCode: {
                description: 'HTTP status code',
                example: exampleValues.httpStatusInternalError,
                type: 'number',
              },
            },
            required: ['error', 'statusCode'],
            type: 'object',
          },
        },
      },
      description: 'Internal server error',
    },
  };
};

const generateOperationDescription = (route: RouteInfo): string => {
  const enhancedDescription = generateMethodDescription(route.serviceMethod, route.serviceClass);

  if (enhancedDescription) {
    return enhancedDescription;
  }

  const parts: string[] = [];

  if (route.serviceClass && route.serviceMethod) {
    parts.push(`Calls ${route.serviceClass}.${route.serviceMethod}()`);
  }

  if (route.requestType === 'tRPC') {
    parts.push(`tRPC ${route.type || 'query'} procedure`);
  } else {
    parts.push('HTTP endpoint');
  }

  return parts.join(' - ');
};

const generateOperation = (route: RouteInfo): OpenApiOperation => {
  const operation: OpenApiOperation = {
    description: generateOperationDescription(route),
    responses: generateResponses(route),
    summary: generateOperationSummary(route),
    tags: generateOperationTags(route),
  };

  if (route.input && route.input.length > 0) {
    const method = (route.method || 'get').toLowerCase();

    if (['delete', 'get', 'head'].includes(method)) {
      operation.parameters = route.input.map((param) => convertToQueryParameter(param));
    } else {
      operation.requestBody = {
        content: {
          'application/json': {
            schema: convertParametersToRequestBodySchema(route.input),
          },
        },
        required: route.input.some((p) => p.required),
      };
    }
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

    if (!groups[normalizedPath]) {
      groups[normalizedPath] = [];
    }

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
      const method = (route.method || 'get').toLowerCase();
      const operation = generateOperation(route);

      spec.paths[path][method] = operation;
    }
  }

  return spec;
};

export type { OpenApiOperation, OpenApiParameter, OpenApiResponse, OpenApiSchema, OpenApiSpec };
export {
  exampleValues,
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
