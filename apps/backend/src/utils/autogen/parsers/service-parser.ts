import { getProject, servicesDir } from '../config';
import type { ServiceMetadata } from '../types';
import type { SourceFile } from 'ts-morph';
import { extractParameterMetadata } from '@lightproject/common/utils';

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
    return { input: undefined, serviceFilePath: undefined };
  }

  const project = getProject();
  const serviceFile = project
    .getSourceFiles(`${servicesDir}/**/*.ts`)
    .find((sf) => sf.getClass(serviceClass));

  if (!serviceFile) {
    return { input: undefined, serviceFilePath: undefined };
  }

  const serviceFilePath = serviceFile.getFilePath();
  const serviceClassDecl = serviceFile.getClass(serviceClass);
  const methodDecl = serviceClassDecl?.getMethod(serviceMethod);

  if (methodDecl === undefined || (serviceFilePath as string) === '') {
    return { input: undefined, serviceFilePath };
  }

  const input = await Promise.resolve(
    extractParameterMetadata(methodDecl, serviceFilePath, serviceClass, serviceMethod),
  );

  return { input, serviceFilePath };
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
