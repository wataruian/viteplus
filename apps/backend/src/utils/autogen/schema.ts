import { apiEndpoint } from '@lightproject/common/configs';
import { toPascalCase } from '@lightproject/common/utils';
import { isRecord } from '@lightproject/common/validators';
import { z } from 'zod';

import type { ParsedType, RouteInfo } from '../../middlewares/initialize-request';
import { createBaseResponseSchema } from '../route-handler';
import { servicesDir } from './config';

// -----------------------------------------------------------------------------
// Zod Parsing
// -----------------------------------------------------------------------------

const getLiteralBaseType = (type: string): 'string' | 'number' | 'boolean' | 'any' => {
  if (type === 'string') {
    return 'string';
  }

  if (type === 'number') {
    return 'number';
  }

  if (type === 'boolean') {
    return 'boolean';
  }

  return 'any';
};

const zodToParsedType = (schema: z.ZodType): ParsedType => {
  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault
  ) {
    const inner = schema.unwrap();

    if (inner instanceof z.ZodType) {
      const parsed = zodToParsedType(inner);
      return { ...parsed, required: false };
    }
  }

  if (schema instanceof z.ZodString) {
    return { base: 'string', kind: 'primitive', required: true };
  }

  if (schema instanceof z.ZodNumber) {
    return { base: 'number', kind: 'primitive', required: true };
  }

  if (schema instanceof z.ZodBoolean) {
    return { base: 'boolean', kind: 'primitive', required: true };
  }

  if (schema instanceof z.ZodVoid || schema instanceof z.ZodUndefined) {
    return { base: 'void', kind: 'primitive', required: false };
  }

  if (schema instanceof z.ZodAny || schema instanceof z.ZodUnknown) {
    return { base: 'any', kind: 'primitive', required: true };
  }

  if (schema instanceof z.ZodArray) {
    const { element } = schema;

    if (element instanceof z.ZodType) {
      return { itemType: zodToParsedType(element), kind: 'array', required: true };
    }
  }

  if (schema instanceof z.ZodObject) {
    const properties: Record<string, ParsedType> = {};
    const shape = schema.shape as Record<string, z.ZodType>;

    for (const [key, propSchema] of Object.entries(shape)) {
      properties[key] = zodToParsedType(propSchema);
    }

    return { kind: 'object', properties, required: true };
  }

  if (schema instanceof z.ZodUnion) {
    return {
      kind: 'union',
      required: true,
      types: schema.options
        .filter((opt: unknown): opt is z.ZodType => opt instanceof z.ZodType)
        .map((opt: z.ZodType) => zodToParsedType(opt)),
    };
  }

  if (schema instanceof z.ZodEnum) {
    return { base: 'string', kind: 'primitive', required: true };
  }

  if (schema instanceof z.ZodLiteral) {
    return { base: getLiteralBaseType(typeof schema.value), kind: 'primitive', required: true };
  }

  return { base: 'any', kind: 'primitive', required: true };
};

// -----------------------------------------------------------------------------
// Service Metadata
// -----------------------------------------------------------------------------

const getServiceNameFromHandlerFile = (handlerFilePath: string): string | undefined => {
  try {
    const fileName = handlerFilePath.split('/').pop()?.replace('.ts', '');

    if (fileName === undefined || fileName === '') {
      return undefined;
    }

    return `${toPascalCase(fileName)}Service`;
  } catch {
    return undefined;
  }
};

const buildInputParams = (
  inputType?: ParsedType,
): { name: string; type: ParsedType; required: boolean }[] => {
  if (!inputType || inputType.base === 'void') {
    return [];
  }

  if (inputType.kind === 'object' && inputType.properties) {
    return Object.entries(inputType.properties).map(([name, type]) => {
      if (typeof type === 'string') {
        throw new TypeError('Type is a string');
      }

      return { name, required: type.required ?? true, type };
    });
  }

  return [{ name: 'payload', required: inputType.required ?? true, type: inputType }];
};

const extractServiceMetadata = async (
  serviceClass: string | undefined,
  serviceMethod: string | undefined,
) => {
  if (
    serviceClass === undefined ||
    serviceClass === '' ||
    serviceMethod === undefined ||
    serviceMethod === ''
  ) {
    return { input: undefined, output: undefined, serviceFilePath: undefined };
  }

  const projectModule = await import('./project');
  const project = projectModule.getProject();
  const serviceFile = project
    .getSourceFiles(`${servicesDir}/**/*.ts`)
    .find((sf) => sf.getClass(serviceClass));

  if (!serviceFile) {
    return { input: undefined, output: undefined, serviceFilePath: undefined };
  }

  const serviceFilePath = serviceFile.getFilePath();

  try {
    const serviceModule: unknown = await import(serviceFilePath);

    if (!isRecord(serviceModule)) {
      throw new Error('Service module is not a record');
    }

    const inputSchemasName = `${serviceClass}InputSchemas`;
    const outputSchemasName = `${serviceClass}OutputSchemas`;

    let inputType: ParsedType | undefined = undefined;

    if (
      isRecord(serviceModule[inputSchemasName]) &&
      serviceMethod in serviceModule[inputSchemasName]
    ) {
      const schema = serviceModule[inputSchemasName][serviceMethod];

      if (schema instanceof z.ZodType) {
        inputType = zodToParsedType(schema);
      }
    }

    let outputType: ParsedType | undefined = undefined;

    if (
      isRecord(serviceModule[outputSchemasName]) &&
      serviceMethod in serviceModule[outputSchemasName]
    ) {
      const schema = serviceModule[outputSchemasName][serviceMethod];

      if (schema instanceof z.ZodType) {
        outputType = zodToParsedType(createBaseResponseSchema(schema));
      }
    }

    outputType ??= zodToParsedType(createBaseResponseSchema());

    return {
      input: buildInputParams(inputType),
      output: {
        description: 'Response from the service method',
        name: 'return',
        required: outputType.required ?? true,
        type: outputType,
      },
      serviceFilePath,
    };
  } catch {
    return { input: undefined, output: undefined, serviceFilePath };
  }
};

// -----------------------------------------------------------------------------
// OpenAPI Generation
// -----------------------------------------------------------------------------

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

interface OpenApiDocument {
  components: { schemas: Record<string, unknown> };
  info: { description: string; title: string; version: string };
  openapi: string;
  paths: Record<string, Record<string, OpenApiOperation>>;
  servers: { description: string; url: string }[];
}

interface OpenApiOperation {
  parameters?: unknown[];
  requestBody?: unknown;
  responses: Record<string, { content?: unknown; description?: string }>;
  summary: string;
  tags: string[];
}

const isParsedType = (val: unknown): val is ParsedType =>
  typeof val === 'object' && val !== null && 'kind' in val;

const parsedTypeToString = (parsed: ParsedType | string | Record<string, unknown>): string => {
  if (typeof parsed === 'string') {
    return parsed;
  }

  if (!isParsedType(parsed)) {
    return 'unknown';
  }

  switch (parsed.kind) {
    case 'primitive': {
      return parsed.base ?? 'unknown';
    }
    case 'array': {
      return `${parsedTypeToString(parsed.itemType ?? 'unknown')}[]`;
    }
    case 'union': {
      return (parsed.types ?? []).map((t) => parsedTypeToString(t)).join(' | ');
    }
    case 'object': {
      const props = Object.entries(parsed.properties ?? {}).map(([k, v]) => {
        const isOptional = isParsedType(v) && v.required === false;
        return `${k}${isOptional ? '?' : ''}: ${parsedTypeToString(v)}`;
      });
      return `{ ${props.join('; ')} }`;
    }
    default: {
      return 'unknown';
    }
  }
};

const getFallbackDefault = (
  type: ParsedType | string | Record<string, unknown> | undefined,
): string | number | boolean | undefined => {
  if (type === undefined) {
    return undefined;
  }

  const typeStr = parsedTypeToString(type);
  if (typeStr === 'string') {
    return 'string';
  }

  if (typeStr === 'number') {
    return 0;
  }

  if (typeStr === 'boolean') {
    return false;
  }

  return undefined;
};

const parseObjectProperties = (content: string): string[] => {
  const properties: string[] = [];

  let braceDepth = 0;
  let current = '';

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
    return { ...schema, items: convertTypeToSchema(typeString.slice(0, -2)), type: 'array' };
  }

  if (typeString.includes(' | ')) {
    const unionTypes = typeString
      .split(' | ')
      .map((t) => t.trim())
      .filter((t) => t !== 'undefined');

    if (unionTypes.length === 1) {
      return convertTypeToSchema(unionTypes[0], defaultValue);
    }

    return { ...schema, oneOf: unionTypes.map((t) => convertTypeToSchema(t)) };
  }

  if (typeString.startsWith('{') && typeString.endsWith('}')) {
    const objectSchema: OpenApiSchema = { ...schema, properties: {}, type: 'object' };

    const content = typeString.slice(1, -1).trim();
    if (!content) {
      return objectSchema;
    }

    const required: string[] = [];
    const properties: Record<string, OpenApiSchema> = {};

    for (const prop of parseObjectProperties(content)) {
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
      return { ...schema, description: 'Any value' };
    }
    case 'boolean': {
      return { ...schema, type: 'boolean' };
    }
    case 'number': {
      return { ...schema, type: 'number' };
    }
    case 'string': {
      return { ...schema, type: 'string' };
    }
    default: {
      return { ...schema, description: `Type: ${typeString}`, type: 'string' };
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
        return `array<${formatParsedTypeForDescription(parsed.itemType, indent)}>`;
      }
      case 'union': {
        return (parsed.types ?? [])
          .map((t) => formatParsedTypeForDescription(t, indent))
          .join(' | ');
      }
      case 'object': {
        const entries = Object.entries(parsed.properties ?? {});
        if (entries.length === 0) {
          return '{}';
        }
        const currentIndent = '  '.repeat(indent);
        const nextIndent = '  '.repeat(indent + 1);
        const props = entries.map(([k, v]) => {
          const isOptional = isParsedType(v) && v.required === false;
          return `${nextIndent}${k}${isOptional ? '?' : ''}: ${formatParsedTypeForDescription(v, indent + 1)};`;
        });
        return `{\n${props.join('\n')}\n${currentIndent}}`;
      }
      default: {
        return 'unknown';
      }
    }
  }

  return typeof parsed === 'string' ? parsed : 'unknown';
};

const escapeHtml = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const formatOpenApiSchemaForDescription = (schema: OpenApiSchema, indent = 0): string => {
  if (schema.type === 'array' && schema.items) {
    return `array<${formatOpenApiSchemaForDescription(schema.items, indent)}>`;
  }

  if (schema.type === 'object') {
    if (schema.properties) {
      const entries = Object.entries(schema.properties);

      if (entries.length === 0) {
        return '{}';
      }

      const currentIndent = '  '.repeat(indent);
      const nextIndent = '  '.repeat(indent + 1);
      const props = entries.map(
        ([k, v]) =>
          `${nextIndent}${k}${schema.required?.includes(k) === true ? '' : '?'}: ${formatOpenApiSchemaForDescription(v, indent + 1)};`,
      );

      return `{\n${props.join('\n')}\n${currentIndent}}`;
    }

    if (
      schema.additionalProperties !== undefined &&
      schema.additionalProperties !== false &&
      typeof schema.additionalProperties === 'object'
    ) {
      return `Record<string, ${formatOpenApiSchemaForDescription(schema.additionalProperties, indent)}>`;
    }

    return 'object';
  }

  return schema.type ?? 'unknown';
};

const buildRequestBody = (
  otherInputParams: NonNullable<RouteInfo['input']>,
  operation: OpenApiOperation,
) => {
  let html =
    '<div class="body-structure"><table class="model"><thead><tr><th>Name</th><th>Type</th></tr></thead><tbody>';

  for (const param of otherInputParams) {
    const formatted = formatParsedTypeForDescription(param.type);
    const escaped = escapeHtml(formatted);
    const cellType = formatted.includes('\n')
      ? `<pre><code>${escaped.replaceAll('\n', '<br>').replaceAll(' ', '&nbsp;')}</code></pre>`
      : `<code>${escaped}</code>`;
    html += `<tr><td><strong>${param.name}</strong>${param.required === true ? ' <font color="#f93e3e">*</font>' : ''}</td><td>${cellType}</td></tr>`;
  }

  html += '</tbody></table></div>';

  const properties: Record<string, OpenApiSchema> = {};
  const required: string[] = [];

  for (const param of otherInputParams) {
    properties[param.name] = convertTypeToSchema(param.type, param.defaultValue);
    if (param.required === true) {
      required.push(param.name);
    }
  }

  const reqBodySchema: OpenApiSchema = { properties, type: 'object' };

  if (required.length > 0) {
    reqBodySchema.required = required;
  }

  operation.requestBody = {
    content: { 'application/json': { schema: reqBodySchema } },
    description: html,
  };
};

const buildOperationParameters = (
  route: RouteInfo,
  method: string,
  operation: OpenApiOperation,
) => {
  const pathParams = [
    ...new Set([
      ...[...route.path.matchAll(/:(?<paramName>[a-zA-Z0-9_]+)/gu)].map(
        (m) => m.groups?.['paramName'] ?? '',
      ),
      ...[...route.path.matchAll(/\{(?<paramName>[a-zA-Z0-9_]+)\}/gu)].map(
        (m) => m.groups?.['paramName'] ?? '',
      ),
    ]),
  ];

  if (route.input && route.input.length > 0) {
    const pathInputParams = route.input.filter((p) => pathParams.includes(p.name));
    const otherInputParams = route.input.filter((p) => !pathParams.includes(p.name));
    const parameters = [];

    for (const param of pathInputParams) {
      const fallbackDefault = getFallbackDefault(param.type);

      parameters.push({
        in: 'path',
        name: param.name,
        required: true,
        schema: convertTypeToSchema(param.type, param.defaultValue ?? fallbackDefault),
        ...(param.description !== undefined && param.description !== ''
          ? { description: param.description }
          : {}),
      });
    }

    for (const param of otherInputParams) {
      if (['delete', 'get', 'head'].includes(method)) {
        const fallbackDefault = getFallbackDefault(param.type);
        const formatted = formatParsedTypeForDescription(param.type);

        parameters.push({
          description: formatted.includes('\n')
            ? `\`\`\`typescript\n${formatted}\n\`\`\``
            : `\`${formatted}\``,
          in: 'query',
          name: param.name,
          required: param.required ?? false,
          schema: convertTypeToSchema(param.type, param.defaultValue ?? fallbackDefault),
        });
      }
    }

    if (!['delete', 'get', 'head'].includes(method) && otherInputParams.length > 0) {
      buildRequestBody(otherInputParams, operation);
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
};

const buildOperationSchema = (route: RouteInfo, method: string): OpenApiOperation => {
  const serviceName = route.serviceClass?.replace('Service', '') ?? 'Unknown';
  const methodName = route.serviceMethod ?? 'unknown';
  const summary =
    route.requestType === 'tRPC'
      ? `${serviceName} ${methodName} (${route.type === 'mutation' ? 'Mutation' : 'Query'})`
      : `${serviceName} ${methodName}`;
  const operation: OpenApiOperation = { responses: {}, summary, tags: [route.requestType] };

  const successSchema =
    route.output === undefined ? { type: 'object' } : convertTypeToSchema(route.output.type);
  const isFailure =
    route.path.toLowerCase().includes('fail') ||
    (route.serviceMethod?.toLowerCase().includes('fail') ?? false);
  const statusCode = isFailure ? '500' : '200';
  const descriptionLabel = isFailure ? 'Failed response' : 'Successful response';

  const tRpcFailureSchema = {
    properties: {
      error: {
        properties: {
          json: {
            properties: {
              code: { type: 'number' },
              error: {
                properties: {
                  code: { type: 'string' },
                  httpStatus: { type: 'number' },
                  message: { type: 'string' },
                  name: { type: 'string' },
                  path: { type: 'string' },
                  stack: { type: 'string' },
                  statusCode: { type: 'number' },
                },
                required: ['code', 'httpStatus', 'message', 'name', 'statusCode'],
                type: 'object',
              },
              message: { type: 'string' },
              sessionId: { type: 'string' },
              success: { type: 'boolean' },
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

  const tRpcSuccessSchema = {
    properties: {
      result: {
        properties: {
          data: { properties: { json: successSchema }, required: ['json'], type: 'object' },
        },
        required: ['data'],
        type: 'object',
      },
    },
    required: ['result'],
    type: 'object',
  };

  let finalSchema: OpenApiSchema = successSchema;

  if (route.requestType === 'tRPC') {
    finalSchema = isFailure ? tRpcFailureSchema : tRpcSuccessSchema;
  }

  let responseDescription = descriptionLabel;

  if (finalSchema.properties) {
    const rows = ['| Name | Type |', '| --- | --- |'];

    for (const [name, propSchema] of Object.entries(finalSchema.properties)) {
      const formatted = formatOpenApiSchemaForDescription(propSchema);
      const escaped = escapeHtml(formatted);
      const cellType = formatted.includes('\n')
        ? `<pre><code>${escaped.replaceAll('\n', '<br>').replaceAll(' ', '&nbsp;')}</code></pre>`
        : `\`${formatted}\``;
      rows.push(`| ${name} | ${cellType} |`);
    }

    responseDescription = `${descriptionLabel}\n\n${rows.join('\n')}`;
  }
  operation.responses[statusCode] = {
    content: { 'application/json': { schema: finalSchema } },
    description: responseDescription,
  };

  buildOperationParameters(route, method, operation);

  return operation;
};

const generateOpenApiSpec = (routes: RouteInfo[]) => {
  const spec: OpenApiDocument = {
    components: { schemas: {} },
    info: {
      description: 'Auto-generated API documentation for Pancake platform',
      title: 'Pancake API',
      version: '1.0.0',
    },
    openapi: '3.0.3',
    paths: {},
    servers: [{ description: 'Development server', url: 'http://localhost:3000' }],
  };

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

  for (const [path, pathRoutes] of Object.entries(groups)) {
    spec.paths[path] = {};

    for (const route of pathRoutes) {
      const method = (route.method ?? 'get').toLowerCase();
      spec.paths[path][method] = buildOperationSchema(route, method);
    }
  }

  return spec;
};

export {
  buildInputParams,
  buildOperationParameters,
  buildOperationSchema,
  buildRequestBody,
  convertTypeToSchema,
  escapeHtml,
  extractServiceMetadata,
  formatOpenApiSchemaForDescription,
  formatParsedTypeForDescription,
  generateOpenApiSpec,
  getFallbackDefault,
  getLiteralBaseType,
  getServiceNameFromHandlerFile,
  isParsedType,
  parsedTypeToString,
  parseObjectProperties,
  zodToParsedType,
};
export type { OpenApiDocument, OpenApiOperation, OpenApiSchema };
