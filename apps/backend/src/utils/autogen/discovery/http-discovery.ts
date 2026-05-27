import { extractServiceMetadata, getServiceNameFromHandlerFile } from '../parsers/service-parser';
import { getProject, projectDir } from '../config';
import { Node } from 'ts-morph';
import type { RouteInfo } from '../types';
import { extractHttpServiceMethod } from '../parsers/http-parser';

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

const extractRoutePath = (nameNode: Node): string | null => {
  if (Node.isStringLiteral(nameNode)) {
    return nameNode.getLiteralValue();
  }
  if (Node.isIdentifier(nameNode)) {
    return nameNode.getText();
  }
  return null;
};

const processRouteProperties = async (
  expression: Node,
  handlerFilePath: string,
  routes: RouteInfo[],
): Promise<void> => {
  if (!Node.isObjectLiteralExpression(expression)) {
    return;
  }

  const routePromises = expression.getProperties().map(async (property) => {
    if (!Node.isPropertyAssignment(property)) {
      return null;
    }

    const nameNode = property.getNameNode();
    const routePath = extractRoutePath(nameNode);

    if (routePath === null || routePath === '') {
      return null;
    }

    const method = extractHttpMethod(property.getInitializer());
    const serviceClass = getServiceNameFromHandlerFile(handlerFilePath);
    const serviceMethod = extractHttpServiceMethod(handlerFilePath, routePath);

    const { input, output, serviceFilePath } = await extractServiceMetadata(
      serviceClass,
      serviceMethod,
    );

    const returnValue = {
      handlerFilePath,
      input,
      method,
      output,
      path: routePath,
      requestType: 'HTTP',
      serviceClass,
      serviceFilePath,
      serviceMethod,
    } as RouteInfo;

    globalThis.console.log('httpReturnValue', returnValue);

    return returnValue;
  });

  const discoveredRoutes = await Promise.all(routePromises);
  routes.push(...discoveredRoutes.filter((route): route is RouteInfo => route !== null));
};

const getHttpRoutes = async (): Promise<RouteInfo[]> => {
  const routes: RouteInfo[] = [];
  const project = getProject();
  const httpRouterPath = `${projectDir}/src/routers/http/index.ts`;
  const httpRouterFile = project.getSourceFile(httpRouterPath);

  if (!httpRouterFile) {
    return routes;
  }

  const importedRouteNames = httpRouterFile
    .getImportDeclarations()
    .map((importDecl) => importDecl.getDefaultImport()?.getText())
    .filter((name): name is string => name !== undefined);

  const discoveryPromises = importedRouteNames.map(async (routeName) => {
    const handlerFilePath = `${projectDir}/src/routers/http/routes/${routeName.replace('Routes', '').toLowerCase()}.ts`;
    const handlerFile = project.getSourceFile(handlerFilePath);

    if (!handlerFile) {
      return;
    }

    const exportAssignment = handlerFile
      .getExportAssignments()
      .find((assignment) => !assignment.isExportEquals());

    if (!exportAssignment) {
      return;
    }

    let expression = exportAssignment.getExpression();
    if (Node.isIdentifier(expression)) {
      const varDecl = handlerFile.getVariableDeclaration(expression.getText());
      if (varDecl) {
        const init = varDecl.getInitializer();
        if (init) {
          expression = init;
        }
      }
    }

    await processRouteProperties(expression, handlerFilePath, routes);
  });

  await Promise.all(discoveryPromises);

  return routes;
};

export { extractHttpMethod, extractRoutePath, processRouteProperties, getHttpRoutes };
