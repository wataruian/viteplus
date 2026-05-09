import type { ParameterMetadata } from '@lightproject/common';

import type { RouteInfo } from '../types';

/**
 * OpenAPI operation definition
 */
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

/**
 * OpenAPI parameter definition
 */
interface OpenApiParameter {
  description?: string;
  in: 'cookie' | 'header' | 'path' | 'query';
  name: string;
  required?: boolean;
  schema: OpenApiSchema;
}

/**
 * OpenAPI response definition
 */
interface OpenApiResponse {
  content?: Record<string, { schema: OpenApiSchema }>;
  description: string;
}

/**
 * OpenAPI schema definition
 */
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

/**
 * Constants for example values
 */
const EXAMPLE_NUMBER_VALUE = 123;
const EXAMPLE_SECOND_NUMBER_VALUE = 456;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

/**
 * Example values for OpenAPI schema generation
 */
const EXAMPLE_VALUES = {
  booleanArray: [true, false],
  booleanValue: true,
  httpStatusBadRequest: HTTP_STATUS_BAD_REQUEST,
  httpStatusInternalError: HTTP_STATUS_INTERNAL_SERVER_ERROR,
  numberArray: [EXAMPLE_NUMBER_VALUE, EXAMPLE_SECOND_NUMBER_VALUE],
  numberValue: EXAMPLE_NUMBER_VALUE,
  stringArray: ['ABC', 'DEF'],
  stringValue: 'ABC',
} as const;

/**
 * OpenAPI 3.0 specification structure
 */
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
  servers: Array<{
    description?: string;
    url: string;
  }>;
}

/**
 * Generate OpenAPI 3.0 specification from route information
 */
const generateOpenApiSpec = (
  routes: RouteInfo[],
  options: {
    description?: string;
    serverUrl?: string;
    title?: string;
    version?: string;
  } = {}
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

  // Group routes by path and method
  const pathGroups = groupRoutesByPath(routes);

  // Generate paths
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

/**
 * Group routes by normalized path
 */
const groupRoutesByPath = (
  routes: RouteInfo[]
): Record<string, RouteInfo[]> => {
  const groups: Record<string, RouteInfo[]> = {};

  for (const route of routes) {
    // Normalize path - handle empty paths
    let normalizedPath = route.path || '/';

    // Ensure path starts with /
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

/**
 * Generate OpenAPI operation from route info
 */
const generateOperation = (route: RouteInfo): OpenApiOperation => {
  const operation: OpenApiOperation = {
    description: generateOperationDescription(route),
    responses: generateResponses(route),
    summary: generateOperationSummary(route),
    tags: generateOperationTags(route),
  };

  // Handle parameters
  if (route.input && route.input.length > 0) {
    const method = (route.method || 'get').toLowerCase();

    if (['delete', 'get', 'head'].includes(method)) {
      // Query parameters for GET/DELETE operations
      operation.parameters = route.input.map(param =>
        convertToQueryParameter(param)
      );
    } else {
      // Request body for POST/PUT/PATCH operations
      operation.requestBody = {
        content: {
          'application/json': {
            schema: convertParametersToRequestBodySchema(route.input),
          },
        },
        required: route.input.some(p => p.required),
      };
    }
  }

  return operation;
};

/**
 * Generate operation summary
 */
const generateOperationSummary = (route: RouteInfo): string => {
  const serviceName = route.serviceClass?.replace('Service', '') || 'Unknown';
  const methodName = route.serviceMethod || 'unknown';

  if (route.requestType === 'tRPC') {
    const procedureType = route.type === 'mutation' ? 'Mutation' : 'Query';
    return `${serviceName} ${methodName} (${procedureType})`;
  }

  return `${serviceName} ${methodName}`;
};

/**
 * Generate operation description with enhanced context
 */
const generateOperationDescription = (route: RouteInfo): string => {
  // Try to generate a more descriptive description based on method patterns
  const enhancedDescription = generateMethodDescription(
    route.serviceMethod,
    route.serviceClass
  );

  if (enhancedDescription) {
    return enhancedDescription;
  }

  // Fallback to basic description
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

/**
 * Generate enhanced method description based on method name and service class
 */
const generateMethodDescription = (
  methodName?: string,
  serviceClass?: string
): string | undefined => {
  if (!(methodName && serviceClass)) {
    return;
  }

  const service = serviceClass.replace('Service', '');

  // Method prefix lengths for resource extraction
  const GetPrefixLength = 3; // "get".length
  const CreateAddPrefixLength = 6; // "create".length, "add".length
  const UpdateEditPrefixLength = 6; // "update".length, "edit".length
  const DeleteRemovePrefixLength = 6; // "delete".length, "remove".length

  // Handle common method patterns
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

  return; // Let the caller use fallback description
};

/**
 * Generate operation tags
 */
const generateOperationTags = (route: RouteInfo): string[] => {
  const tags: string[] = [];

  // Add service-based tag
  if (route.serviceClass) {
    tags.push(route.serviceClass.replace('Service', ''));
  }

  // Add request type tag
  tags.push(route.requestType);

  return tags;
};

/**
 * Generate responses for the operation with enhanced schemas
 */
const generateResponses = (
  route: RouteInfo
): Record<string, OpenApiResponse> => {
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
                example: EXAMPLE_VALUES.httpStatusBadRequest,
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
                example: EXAMPLE_VALUES.httpStatusInternalError,
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

/**
 * Generate enhanced response schema based on method patterns
 */
const generateEnhancedResponseSchema = (methodName?: string): OpenApiSchema => {
  if (!methodName) {
    return getDefaultResponseSchema();
  }

  // Pattern-based response schemas
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
          properties: {
            // This would be dynamically generated based on input parameters
          },
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
          example: EXAMPLE_VALUES.booleanArray,
          items: { type: 'boolean' },
          type: 'array',
        },
        booleanOutput: {
          example: EXAMPLE_VALUES.booleanValue,
          type: 'boolean',
        },
        numberArrayOutput: {
          example: EXAMPLE_VALUES.numberArray,
          items: { type: 'number' },
          type: 'array',
        },
        numberOutput: {
          example: EXAMPLE_VALUES.numberValue,
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
          example: EXAMPLE_VALUES.stringArray,
          items: { type: 'string' },
          type: 'array',
        },
        stringOutput: {
          example: EXAMPLE_VALUES.stringValue,
          type: 'string',
        },
      },
      type: 'object',
    };
  }

  // Default enhanced response
  return getDefaultResponseSchema();
};

/**
 * Get default response schema with enhanced structure
 */
const getDefaultResponseSchema = (): OpenApiSchema => {
  return {
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
  };
};

/**
 * Convert parameter metadata to query parameter
 */
const convertToQueryParameter = (
  param: ParameterMetadata
): OpenApiParameter => {
  return {
    in: 'query',
    name: param.name,
    required: param.required,
    schema: convertTypeToSchema(param.type, param.defaultValue),
  };
};

/**
 * Convert parameters to request body schema
 */
const convertParametersToRequestBodySchema = (
  params: ParameterMetadata[]
): OpenApiSchema => {
  const properties: Record<string, OpenApiSchema> = {};
  const required: string[] = [];

  for (const param of params) {
    properties[param.name] = convertTypeToSchema(
      param.type,
      param.defaultValue
    );

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

/**
 * Convert TypeScript type string to OpenAPI schema
 */
const convertTypeToSchema = (
  type: string,
  defaultValue?: unknown
): OpenApiSchema => {
  const schema: OpenApiSchema = {};

  if (defaultValue !== undefined) {
    schema.default = defaultValue;
  }

  // Handle array types
  if (type.endsWith('[]')) {
    const itemType = type.slice(0, -2);
    return {
      default: defaultValue,
      items: convertTypeToSchema(itemType),
      type: 'array',
    };
  }

  // Handle union types (e.g., "string | undefined")
  if (type.includes(' | ')) {
    const unionTypes = type.split(' | ').map(t => t.trim());
    const nonUndefinedTypes = unionTypes.filter(t => t !== 'undefined');

    if (nonUndefinedTypes.length === 1) {
      const [singleType] = nonUndefinedTypes;
      if (singleType) {
        return convertTypeToSchema(singleType, defaultValue);
      }
    }

    return {
      default: defaultValue,
      oneOf: nonUndefinedTypes.map(t => convertTypeToSchema(t)),
    };
  }

  // Handle object types
  if (type.startsWith('{') && type.endsWith('}')) {
    return convertObjectTypeToSchema(type, defaultValue);
  }

  // Handle primitive types
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

/**
 * Convert object type string to OpenAPI schema
 * Handles types like "{ foo: string; bar?: number; }"
 */
const convertObjectTypeToSchema = (
  type: string,
  defaultValue?: unknown
): OpenApiSchema => {
  const schema: OpenApiSchema = {
    default: defaultValue,
    properties: {},
    type: 'object',
  };

  // Simple parsing of object type - this could be enhanced with proper TypeScript AST parsing
  const content = type.slice(1, -1).trim(); // Remove { }

  if (!content) {
    return schema;
  }

  const required: string[] = [];
  const properties: Record<string, OpenApiSchema> = {};

  // Split by semicolon but handle nested objects
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

  schema.properties = properties;
  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
};

/**
 * Parse object properties handling nested braces
 */
const parseObjectProperties = (content: string): string[] => {
  const properties: string[] = [];
  let current = '';
  let braceDepth = 0;

  for (const char of content) {
    if (char === '{') {
      braceDepth++;
    } else if (char === '}') {
      braceDepth--;
    } else if (char === ';' && braceDepth === 0) {
      if (current.trim()) {
        properties.push(current.trim());
      }
      current = '';
      continue;
    }

    current += char;
  }

  // Add the last property if it doesn't end with semicolon
  if (current.trim()) {
    properties.push(current.trim());
  }

  return properties;
};

// Export the main function at the end
export { generateOpenApiSpec };
