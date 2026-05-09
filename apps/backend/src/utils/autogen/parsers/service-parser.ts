import { paramParser } from '@lightproject/common/utils';
import type { SourceFile } from 'ts-morph';
import { getProject, servicesDir } from '../config';
import type { ServiceMetadata } from '../types';

/**
 * Extract service metadata (parameters) from service class and method
 */
export const extractServiceMetadata = async (
  serviceClass: string | undefined,
  serviceMethod: string | undefined
): Promise<ServiceMetadata> => {
  if (!(serviceClass && serviceMethod)) {
    return { input: undefined, serviceFilePath: undefined };
  }

  const project = getProject();
  const serviceFile = project
    .getSourceFiles(`${servicesDir}/**/*.ts`)
    .find(sf => sf.getClass(serviceClass));

  if (!serviceFile) {
    return { input: undefined, serviceFilePath: undefined };
  }

  const serviceFilePath = serviceFile.getFilePath();
  const serviceClassDecl = serviceFile.getClass(serviceClass);
  const methodDecl = serviceClassDecl?.getMethod(serviceMethod);

  if (!(methodDecl && serviceFilePath)) {
    return { input: undefined, serviceFilePath };
  }

  // Use hybrid approach: invoker + AST
  const input = await Promise.resolve(
    paramParser.extractParameterMetadata(
      methodDecl,
      serviceFilePath,
      serviceClass,
      serviceMethod
    )
  );

  return { input, serviceFilePath };
};

/**
 * Convert kebab-case filename to PascalCase class name
 */
export const toPascalCase = (str: string): string =>
  str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

/**
 * Extract service class name from handler file path
 * Converts: '/path/to/default.ts' -> 'DefaultService'
 * Converts: '/path/to/user-profile.ts' -> 'UserProfileService'
 */
export const getServiceNameFromHandlerFile = (
  handlerFilePath: string
): string | undefined => {
  try {
    // Extract filename without extension
    const fileName = handlerFilePath.split('/').pop()?.replace('.ts', '');

    if (!fileName) {
      return;
    }

    // Convert to PascalCase and append 'Service'
    const pascalCase = toPascalCase(fileName);
    return `${pascalCase}Service`;
  } catch {
    return;
  }
};

/**
 * Get imported route names from router file
 */
export const getImportedRouteNames = (routerFile: SourceFile): string[] => {
  return routerFile
    .getImportDeclarations()
    .map(importDecl => importDecl.getDefaultImport()?.getText())
    .filter((name): name is string => name !== undefined);
};

/**
 * Get route handler file path from route name
 */
export const getRouteHandlerFilePath = (
  routerDirectory: string,
  routeName: string
): string => {
  // Handle different import patterns:
  // import defaultRoutes from './routes/default'; -> './routes/default.ts'
  // import testRoutes from './routes/test'; -> './routes/test.ts'

  const routesDir = `${routerDirectory}/routes`;
  const fileName = routeName.replace('Routes', '').toLowerCase();

  return `${routesDir}/${fileName}.ts`;
};
