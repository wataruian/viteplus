import type { ParameterMetadata, ParsedType } from '@lightproject/common/types';
import type { RouteInfo } from '../types';
import { apiEndpoint } from '@lightproject/common/configs';

interface OpenApiOperation {
  description?: string;
  parameters?: OpenApiParameter[];
  requestBody?: {
    description?: string;
    content: Record<string, { schema: OpenApiSchema }>;
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
  additionalProperties?: boolean | OpenApiSchema;
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

const getPlaceholderForType = (type: ParsedType | string | Record<string, unknown>): unknown => {
  const typeString = parsedTypeToString(type);
  if (typeString === 'string') {
    return 'string';
  }
  if (typeString === 'number') {
    return 0;
  }
  if (typeString === 'boolean') {
    return false;
  }
  return undefined;
};

const convertToQueryParameter = (param: ParameterMetadata): OpenApiParameter => {
  const fallbackDefault = getPlaceholderForType(param.type);
  const result: OpenApiParameter = {
    description: getParameterTypeDescription(param.type),
    in: 'query',
    name: param.name,
    required: param.required ?? false,
    schema: convertTypeToSchema(param.type, param.defaultValue ?? fallbackDefault),
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
    if (
      schema.additionalProperties !== undefined &&
      typeof schema.additionalProperties === 'object'
    ) {
      const valueType = formatOpenApiSchemaForDescription(schema.additionalProperties, indent);
      return `Record<string, ${valueType}>`;
    }
    return 'object';
  }

  return schema.type ?? 'unknown';
};

const generateResponses = (route: RouteInfo): Record<string, OpenApiResponse> => {
  const successSchema =
    route.output === undefined ? { type: 'object' } : convertTypeToSchema(route.output.type);

  const hasFailInPath = route.path.toLowerCase().includes('fail');
  const hasFailInMethod =
    route.serviceMethod === undefined ? false : route.serviceMethod.toLowerCase().includes('fail');
  const isFailure = hasFailInPath || hasFailInMethod;
  const statusCode = isFailure ? '500' : '200';
  const descriptionLabel = isFailure ? 'Failed response' : 'Successful response';

  const getFinalSchema = (): OpenApiSchema => {
    if (route.requestType === 'tRPC') {
      if (isFailure) {
        return {
          properties: {
            error: {
              properties: {
                json: {
                  properties: {
                    code: {
                      type: 'number',
                    },
                    error: {
                      properties: {
                        code: {
                          type: 'string',
                        },
                        httpStatus: {
                          type: 'number',
                        },
                        message: {
                          type: 'string',
                        },
                        name: {
                          type: 'string',
                        },
                        path: {
                          type: 'string',
                        },
                        stack: {
                          type: 'string',
                        },
                        statusCode: {
                          type: 'number',
                        },
                      },
                      required: ['code', 'httpStatus', 'message', 'name', 'statusCode'],
                      type: 'object',
                    },
                    message: {
                      type: 'string',
                    },
                    sessionId: {
                      type: 'string',
                    },
                    success: {
                      type: 'boolean',
                    },
                  },
                  required: ['code', 'error', 'message', 'sessionId', 'success'],
                  type: 'object',
                },
              },
              required: ['json'],
              type: 'object',
            },
          },
          required: ['error'],
          type: 'object',
        };
      }
      return {
        properties: {
          result: {
            properties: {
              data: {
                properties: {
                  json: successSchema,
                },
                required: ['json'],
                type: 'object',
              },
            },
            required: ['data'],
            type: 'object',
          },
        },
        required: ['result'],
        type: 'object',
      };
    }
    return successSchema;
  };

  const finalSchema = getFinalSchema();

  let responseDescription = descriptionLabel;
  if (finalSchema.properties !== undefined) {
    const entries = Object.entries(finalSchema.properties);
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
          schema: finalSchema,
        },
      },
      description: responseDescription,
    },
  };
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
      const fallbackDefault = getPlaceholderForType(param.type);
      const pathParam: OpenApiParameter = {
        in: 'path',
        name: param.name,
        required: true,
        schema: convertTypeToSchema(param.type, param.defaultValue ?? fallbackDefault),
      };
      if (param.description !== undefined) {
        pathParam.description = param.description;
      }
      parameters.push(pathParam);
    }

    for (const param of otherInputParams) {
      const converted = convertToQueryParameter(param);
      if (['delete', 'get', 'head'].includes(method)) {
        parameters.push(converted);
      }
    }

    if (!['delete', 'get', 'head'].includes(method) && otherInputParams.length > 0) {
      let html =
        '<div class="body-structure"><table class="model"><thead><tr><th>Name</th><th>Type</th></tr></thead><tbody>';
      for (const param of otherInputParams) {
        const formatted = formatParsedTypeForDescription(param.type);
        const escaped = escapeHtml(formatted);
        const cellType = formatted.includes('\n')
          ? `<pre><code>${escaped.replaceAll('\n', '<br>').replaceAll(' ', '&nbsp;')}</code></pre>`
          : `<code>${escaped}</code>`;
        const requiredAsterisk = param.required === true ? ' <font color="#f93e3e">*</font>' : '';
        html += `<tr><td><strong>${param.name}</strong>${requiredAsterisk}</td><td>${cellType}</td></tr>`;
      }
      html += '</tbody></table></div>';

      operation.requestBody = {
        content: {
          'application/json': {
            schema: convertParametersToRequestBodySchema(otherInputParams),
          },
        },
        description: html,
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
  getPlaceholderForType,
  parsedTypeToString,
  generateOperationTags,
  generateOperationSummary,
  formatParsedTypeForDescription,
  getParameterTypeDescription,
  escapeHtml,
  formatOpenApiSchemaForDescription,
  extractPathParameters,
  parseObjectProperties,
  convertTypeToSchema,
  convertToQueryParameter,
  convertParametersToRequestBodySchema,
  generateResponses,
  generateOperation,
  groupRoutesByPath,
  generateOpenApiSpec,
};
