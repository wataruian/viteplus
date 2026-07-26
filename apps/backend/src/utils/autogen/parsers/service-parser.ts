import { extractParameterMetadata, extractReturnTypeMetadata } from '@lightproject/common/utils';
import { getProject, servicesDir } from '../config';
import type { ParsedType } from '@lightproject/common/types';
import type { ServiceMetadata } from '../types';
import type { SourceFile } from 'ts-morph';
import { isRecord } from '@lightproject/common/validators';

const isObjectParsedType = (
  val: unknown,
): val is ParsedType & { kind: 'object'; properties: Record<string, ParsedType | string> } =>
  isRecord(val) && val['kind'] === 'object' && isRecord(val['properties']);

const getDataProp = (
  existingData: ParsedType | string | undefined,
  extraProps: Record<string, ParsedType | string>,
  hasExtra: boolean,
): ParsedType | string | undefined => {
  if (isObjectParsedType(existingData)) {
    return {
      kind: 'object',
      properties: {
        ...existingData.properties,
        ...extraProps,
      },
    };
  }
  if (hasExtra) {
    return {
      kind: 'object',
      properties: extraProps,
    };
  }
  return existingData;
};

const wrapOutputProperties = (
  properties: Record<string, ParsedType | string>,
): Record<string, ParsedType | string> => {
  if (
    'error' in properties &&
    'name' in properties &&
    'stack' in properties &&
    'statusCode' in properties
  ) {
    const errorMsg = properties['error'];
    const nameProp = properties['name'];
    const stackProp = properties['stack'];
    const statusCodeProp = properties['statusCode'];

    delete properties['name'];
    delete properties['stack'];
    delete properties['statusCode'];

    properties['error'] = {
      kind: 'object',
      properties: {
        message: errorMsg,
        name: nameProp,
        stack: stackProp,
        statusCode: statusCodeProp,
      },
    };
  }

  const standardKeys = new Set(['code', 'data', 'message', 'sessionId', 'success', 'error']);
  const standardProps: Record<string, ParsedType | string> = {};
  const extraProps: Record<string, ParsedType | string> = {};
  let hasExtra = false;

  for (const [key, prop] of Object.entries(properties)) {
    if (standardKeys.has(key)) {
      standardProps[key] = prop;
    } else {
      extraProps[key] = prop;
      hasExtra = true;
    }
  }

  const existingData = standardProps['data'];
  const dataProp = getDataProp(existingData, extraProps, hasExtra);

  const newProperties: Record<string, ParsedType | string> = {
    ...standardProps,
  };
  if (dataProp !== undefined) {
    newProperties['data'] = dataProp;
  }
  newProperties['code'] ??= { base: 'number', kind: 'primitive', required: true };
  newProperties['message'] ??= { base: 'string', kind: 'primitive', required: true };
  newProperties['sessionId'] ??= { base: 'string', kind: 'primitive', required: true };
  newProperties['success'] ??= { base: 'boolean', kind: 'primitive', required: true };

  return newProperties;
};

const extractServiceMetadata = async (
  serviceClass: string | undefined,
  serviceMethod: string | undefined,
): Promise<ServiceMetadata> => {
  if (
    serviceClass === undefined ||
    serviceMethod === undefined ||
    serviceClass === '' ||
    serviceMethod === ''
  ) {
    return { input: undefined, output: undefined, serviceFilePath: undefined };
  }

  const project = getProject();
  const serviceFile = project
    .getSourceFiles(`${servicesDir}/**/*.ts`)
    .find((sf) => sf.getClass(serviceClass));

  if (!serviceFile) {
    return { input: undefined, output: undefined, serviceFilePath: undefined };
  }

  const serviceFilePath = serviceFile.getFilePath();
  const serviceClassDecl = serviceFile.getClass(serviceClass);
  const methodDecl = serviceClassDecl?.getMethod(serviceMethod);

  if (methodDecl === undefined || (serviceFilePath as string) === '') {
    return { input: undefined, output: undefined, serviceFilePath };
  }

  const input = await Promise.resolve(
    extractParameterMetadata(methodDecl, serviceFilePath, serviceClass, serviceMethod),
  );

  const output = extractReturnTypeMetadata(methodDecl);

  if (output?.type !== undefined && isObjectParsedType(output.type)) {
    output.type.properties = wrapOutputProperties(output.type.properties);
  }

  return { input, output, serviceFilePath };
};

const toPascalCase = (str: string): string =>
  str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

const getServiceNameFromHandlerFile = (handlerFilePath: string): string | undefined => {
  try {
    const fileName = handlerFilePath.split('/').pop()?.replace('.ts', '');

    if (fileName === undefined || fileName === '') {
      return undefined;
    }

    const pascalCase = toPascalCase(fileName);
    return `${pascalCase}Service`;
  } catch {
    return undefined;
  }
};

const getImportedRouteNames = (routerFile: SourceFile): string[] =>
  routerFile
    .getImportDeclarations()
    .map((importDecl) => importDecl.getDefaultImport()?.getText())
    .filter((name): name is string => name !== undefined);

const getRouteHandlerFilePath = (routerDirectory: string, routeName: string): string => {
  const routesDir = `${routerDirectory}/routes`;
  const fileName = routeName.replace('Routes', '').toLowerCase();

  return `${routesDir}/${fileName}.ts`;
};

export {
  extractServiceMetadata,
  toPascalCase,
  getServiceNameFromHandlerFile,
  getImportedRouteNames,
  getRouteHandlerFilePath,
};
