import { Node } from 'ts-morph';
import { getProject, projectDir } from '../config';
import { extractHttpServiceMethod } from '../parsers/http-parser';
import {
  extractServiceMetadata,
  getServiceNameFromHandlerFile,
} from '../parsers/service-parser';
import type { RouteInfo } from '../types';

/**
 * Extract the HTTP method from initializer text
 */
const extractHttpMethod = (initializer: Node | undefined): string => {
  if (!initializer) {
    return 'unknown';
  }

  const text = initializer.getText();
  if (text.includes('publicHttp.get')) {
    return 'get';
  }
  if (text.includes('publicHttp.post')) {
    return 'post';
  }
  if (text.includes('publicHttp.put')) {
    return 'put';
  }
  if (text.includes('publicHttp.delete')) {
    return 'delete';
  }
  if (text.includes('publicHttp.patch')) {
    return 'patch';
  }
  return 'unknown';
};

/**
 * Extract route path from property name node
 */
const extractRoutePath = (nameNode: Node): string | null => {
  if (Node.isStringLiteral(nameNode)) {
    return nameNode.getLiteralValue();
  }
  if (Node.isIdentifier(nameNode)) {
    return nameNode.getText();
  }
  return null;
};

/**
 * Process routes from an object literal expression
 */
const processRouteProperties = async (
  expression: Node,
  handlerFilePath: string,
  routes: RouteInfo[]
): Promise<void> => {
  if (!Node.isObjectLiteralExpression(expression)) {
    console.warn(`Export is not object literal in ${handlerFilePath}`);
    return;
  }

  for (const property of expression.getProperties()) {
    if (!Node.isPropertyAssignment(property)) {
      continue;
    }

    const nameNode = property.getNameNode();
    const routePath = extractRoutePath(nameNode);

    if (!routePath) {
      continue;
    }

    const method = extractHttpMethod(property.getInitializer());
    const serviceClass = getServiceNameFromHandlerFile(handlerFilePath);
    const serviceMethod = extractHttpServiceMethod(handlerFilePath, routePath);

    console.log('HTTP service extraction:', {
      handlerFilePath,
      path: routePath,
      serviceClass,
      serviceMethod,
    });

    const { input, serviceFilePath } = await extractServiceMetadata(
      serviceClass,
      serviceMethod
    );

    routes.push({
      handlerFilePath,
      input,
      method,
      output: undefined,
      path: routePath,
      requestType: 'HTTP',
      serviceClass,
      serviceFilePath,
      serviceMethod,
    });
  }
};

/**
 * Extract all HTTP routes from the HTTP router
 */
export const getHttpRoutes = async (): Promise<RouteInfo[]> => {
  console.log('Extracting HTTP routes...');

  const routes: RouteInfo[] = [];
  const project = getProject();
  const httpRouterPath = `${projectDir}/src/routers/http/index.ts`;
  const httpRouterFile = project.getSourceFile(httpRouterPath);

  if (!httpRouterFile) {
    console.warn(`HTTP router file not found: ${httpRouterPath}`);
    return routes;
  }

  // Get imported route names from the HTTP router
  const importedRouteNames = httpRouterFile
    .getImportDeclarations()
    .map(importDecl => importDecl.getDefaultImport()?.getText())
    .filter((name): name is string => name !== undefined);

  console.log('Found HTTP route imports:', importedRouteNames);

  // Process each imported route file
  for (const routeName of importedRouteNames) {
    const handlerFilePath = `${projectDir}/src/routers/http/routes/${routeName.replace('Routes', '').toLowerCase()}.ts`;
    const handlerFile = project.getSourceFile(handlerFilePath);

    if (!handlerFile) {
      console.warn(`Handler file not found: ${handlerFilePath}`);
      continue;
    }

    console.log(`Processing HTTP routes from: ${handlerFilePath}`);

    const exportAssignment = handlerFile
      .getExportAssignments()
      .find(assignment => !assignment.isExportEquals());

    if (!exportAssignment) {
      console.warn(`No default export found in ${handlerFilePath}`);
      continue;
    }

    await processRouteProperties(
      exportAssignment.getExpression(),
      handlerFilePath,
      routes
    );
  }

  return routes;
};
