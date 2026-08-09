import { extractServiceMetadata, getServiceNameFromHandlerFile } from '../parsers/service-parser';
import { getEnv, isTest, isTrue, isVitest } from '@lightproject/common/environment';
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

  await expression.getProperties().reduce(async (promise, property) => {
    await promise;

    if (!Node.isPropertyAssignment(property)) {
      return;
    }

    const nameNode = property.getNameNode();
    const routePath = extractRoutePath(nameNode);

    if (routePath === null || routePath === '') {
      return;
    }

    const method = extractHttpMethod(property.getInitializer());
    const serviceClass = getServiceNameFromHandlerFile(handlerFilePath);
    const serviceMethod = extractHttpServiceMethod(handlerFilePath, routePath);

    const { input, output, serviceFilePath } = await extractServiceMetadata(
      serviceClass,
      serviceMethod,
    );

    routes.push({
      handlerFilePath,
      input,
      method,
      output,
      path: routePath,
      requestType: 'HTTP',
      serviceClass,
      serviceFilePath,
      serviceMethod,
    });
  }, Promise.resolve());
};

const getHttpRoutes = async (): Promise<RouteInfo[]> => {
  const routes: RouteInfo[] = [];
  const project = getProject();
  const httpRouterPath = `${projectDir}/src/routers/http/index.ts`;
  const httpRouterFile = project.getSourceFile(httpRouterPath);

  if (!httpRouterFile) {
    return routes;
  }

  const rawImportedRouteNames = httpRouterFile
    .getImportDeclarations()
    .map((importDecl) => importDecl.getDefaultImport()?.getText())
    .filter((name): name is string => name !== undefined);

  const importedRouteNames =
    isTrue(getEnv('ENABLE_TEST_ROUTES')) || isTest() || isVitest()
      ? rawImportedRouteNames
      : rawImportedRouteNames.filter((name) => name !== 'testRoutes');

  await importedRouteNames.reduce(async (promise, routeName) => {
    await promise;

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
  }, Promise.resolve());

  return routes;
};

export { extractHttpMethod, extractRoutePath, processRouteProperties, getHttpRoutes };
