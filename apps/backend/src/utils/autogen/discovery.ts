import { extractServiceMetadata, getServiceNameFromHandlerFile } from './schema';
import { getEnv, isTest, isTrue, isVitest } from '@lightproject/common/environment';
import { Node } from 'ts-morph';
import type { RouteInfo } from '../../middlewares/initialize-request';
import { getProject } from './project';
import path from 'node:path';
import { projectDir } from './config';

// -----------------------------------------------------------------------------
// HTTP Discovery
// -----------------------------------------------------------------------------

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

const extractMethod = (node: Node): string | undefined => {
  if (Node.isCallExpression(node)) {
    const expr = node.getExpression();

    if (Node.isIdentifier(expr) && expr.getText() === 'createRouteHandler') {
      const args = node.getArguments();

      if (args.length >= 2 && Node.isStringLiteral(args[1])) {
        return args[1].getLiteralValue();
      }
    }
  }

  for (const child of node.getChildren()) {
    const res = extractMethod(child);

    if (res !== undefined && res !== '') {
      return res;
    }
  }

  return undefined;
};

const extractHttpServiceMethod = (
  handlerFilePath: string,
  routePath: string,
): string | undefined => {
  try {
    const project = getProject();
    const sourceFile = project.getSourceFile(handlerFilePath);

    if (!sourceFile) {
      return undefined;
    }

    const exportAssignments = sourceFile.getExportAssignments();

    if (exportAssignments.length === 0) {
      return undefined;
    }

    let expression = exportAssignments[0].getExpression();
    if (Node.isIdentifier(expression)) {
      const init = sourceFile.getVariableDeclaration(expression.getText())?.getInitializer();

      if (init) {
        expression = init;
      }
    }

    if (!Node.isObjectLiteralExpression(expression)) {
      return undefined;
    }

    const targetProperty = expression.getProperties().find((prop) => {
      if (Node.isPropertyAssignment(prop)) {
        const nameNode = prop.getNameNode();

        if (Node.isStringLiteral(nameNode)) {
          return nameNode.getLiteralValue() === routePath;
        }

        if (Node.isIdentifier(nameNode)) {
          return nameNode.getText() === routePath;
        }
      }

      return false;
    });

    if (!targetProperty || !Node.isPropertyAssignment(targetProperty)) {
      return undefined;
    }

    const propertyValue = targetProperty.getInitializer();

    if (!propertyValue) {
      return undefined;
    }

    return extractMethod(propertyValue);
  } catch {
    return undefined;
  }
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

  const routePromises = importedRouteNames.map(async (routeName) => {
    const handlerFilePath = `${projectDir}/src/routers/http/routes/${routeName.replace('Routes', '').toLowerCase()}.ts`;
    const handlerFile = project.getSourceFile(handlerFilePath);

    if (!handlerFile) {
      return [];
    }

    const exportAssignment = handlerFile
      .getExportAssignments()
      .find((assignment) => !assignment.isExportEquals());

    if (!exportAssignment) {
      return [];
    }

    let expression = exportAssignment.getExpression();

    if (Node.isIdentifier(expression)) {
      const init = handlerFile.getVariableDeclaration(expression.getText())?.getInitializer();

      if (init) {
        expression = init;
      }
    }

    if (!Node.isObjectLiteralExpression(expression)) {
      return [];
    }

    const propPromises = expression
      .getProperties()
      .map(async (property): Promise<RouteInfo | undefined> => {
        if (!Node.isPropertyAssignment(property)) {
          return undefined;
        }

        const nameNode = property.getNameNode();
        let routePath: string | null = null;

        if (Node.isStringLiteral(nameNode)) {
          routePath = nameNode.getLiteralValue();
        } else if (Node.isIdentifier(nameNode)) {
          routePath = nameNode.getText();
        }

        if (routePath === null || routePath === '') {
          return undefined;
        }

        const method = extractHttpMethod(property.getInitializer());
        const serviceClass = getServiceNameFromHandlerFile(handlerFilePath);
        const serviceMethod = extractHttpServiceMethod(handlerFilePath, routePath);

        const { input, output, serviceFilePath } = await extractServiceMetadata(
          serviceClass,
          serviceMethod,
        );

        return {
          handlerFilePath,
          input,
          method,
          output,
          path: routePath,
          requestType: 'HTTP',
          serviceClass,
          serviceFilePath,
          serviceMethod,
        };
      });

    const props = await Promise.all(propPromises);

    return props.filter((r): r is RouteInfo => r !== undefined);
  });

  const routesNested = await Promise.all(routePromises);
  routes.push(...routesNested.flat());

  return routes;
};

// -----------------------------------------------------------------------------
// tRPC Discovery
// -----------------------------------------------------------------------------

interface ExtractedTrpcRoute {
  handlerFilePath: string;
  path: string;
  procedureType: 'mutation' | 'query' | 'subscription' | undefined;
  serviceClass: string | undefined;
  serviceMethod: string | undefined;
}

const extractProcedureType = (procedureCall: Node): 'mutation' | 'query' | 'subscription' => {
  let current: Node | undefined = procedureCall;

  while (current) {
    if (Node.isCallExpression(current)) {
      const expr = current.getExpression();

      if (Node.isPropertyAccessExpression(expr)) {
        const name = expr.getName();

        if (name === 'mutation' || name === 'query' || name === 'subscription') {
          return name;
        }
      }
    }
    current = current.getParent();
  }

  return 'query';
};

const findHandler = (expr: Node): Node | undefined => {
  if (Node.isCallExpression(expr)) {
    const e = expr.getExpression();

    if (Node.isIdentifier(e) && e.getText() === 'createRouteHandler') {
      return expr;
    }

    for (const arg of expr.getArguments()) {
      const found = findHandler(arg);

      if (found) {
        return found;
      }
    }
  }

  return undefined;
};

const extractTrpcRoutesFromFile = (
  routerFilePath: string,
  routerPrefix: string,
): ExtractedTrpcRoute[] => {
  const routes: ExtractedTrpcRoute[] = [];

  try {
    const project = getProject();
    const sourceFile = project.getSourceFile(routerFilePath);

    if (!sourceFile) {
      return routes;
    }

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expr = node.getExpression();

        if (Node.isIdentifier(expr) && expr.getText() === 'router') {
          const args = node.getArguments();

          if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
            const extractRoute = (prop: Node, pathPrefix: string) => {
              if (!Node.isPropertyAssignment(prop)) {
                return;
              }

              let name = prop.getName();

              if (name.startsWith('[') && name.endsWith(']')) {
                name = name.slice(1, -1);
              }

              if (!name) {
                return;
              }

              const fullPath = pathPrefix ? `${pathPrefix}.${name}` : name;
              const trpcPath = `/trpc/${routerPrefix}.${fullPath}`;
              const init = prop.getInitializer();

              if (Node.isCallExpression(init)) {
                let serviceClass: string | undefined = undefined;
                let serviceMethod: string | undefined = undefined;

                const handlerCall = findHandler(init);

                if (handlerCall && Node.isCallExpression(handlerCall)) {
                  const handlerArgs = handlerCall.getArguments();

                  if (handlerArgs.length >= 2) {
                    if (Node.isIdentifier(handlerArgs[0])) {
                      serviceClass = handlerArgs[0].getText();
                    }

                    if (Node.isStringLiteral(handlerArgs[1])) {
                      serviceMethod = handlerArgs[1].getLiteralValue();
                    }
                  }
                }

                const extractedType = extractProcedureType(init);
                routes.push({
                  handlerFilePath: routerFilePath,
                  path: trpcPath,
                  procedureType: extractedType === 'subscription' ? undefined : extractedType,
                  serviceClass,
                  serviceMethod,
                });
              } else if (Node.isObjectLiteralExpression(init)) {
                for (const nested of init.getProperties()) {
                  extractRoute(nested, fullPath);
                }
              }
            };

            for (const prop of args[0].getProperties()) {
              extractRoute(prop, '');
            }
          }
        }
      }
    });

    return routes;
  } catch {
    return routes;
  }
};

const getTrpcRoutes = async (): Promise<RouteInfo[]> => {
  const trpcRouterDir = path.resolve(projectDir, 'src/routers/trpc/routes');

  try {
    const fs = await import('node:fs/promises');
    const rawRouteFiles = await fs.readdir(trpcRouterDir);
    const routeFiles =
      isTrue(getEnv('ENABLE_TEST_ROUTES')) || isTest() || isVitest()
        ? rawRouteFiles
        : rawRouteFiles.filter((f) => f !== 'test.ts');

    const allRoutes: RouteInfo[] = [];

    const filePromises = routeFiles.map(async (file) => {
      if (!file.endsWith('.ts') || file.endsWith('.d.ts')) {
        return [];
      }

      const filePath = path.join(trpcRouterDir, file);

      try {
        const routerPrefix = path.basename(file, '.ts');
        const fileRoutes = extractTrpcRoutesFromFile(filePath, routerPrefix);

        const routePromises = fileRoutes.map(async (route): Promise<RouteInfo | undefined> => {
          if (
            route.serviceClass === undefined ||
            route.serviceClass === '' ||
            route.serviceMethod === undefined ||
            route.serviceMethod === ''
          ) {
            return undefined;
          }

          const { input, output, serviceFilePath } = await extractServiceMetadata(
            route.serviceClass,
            route.serviceMethod,
          );

          const type = route.procedureType ?? 'query';

          return {
            handlerFilePath: filePath,
            input,
            method: type === 'mutation' ? 'post' : 'get',
            output,
            path: route.path,
            requestType: 'tRPC',
            serviceClass: route.serviceClass,
            serviceFilePath,
            serviceMethod: route.serviceMethod,
            type,
          };
        });

        const routesRes = await Promise.all(routePromises);

        return routesRes.filter((r): r is RouteInfo => r !== undefined);
      } catch {
        return [];
      }
    });

    const allRoutesNested = await Promise.all(filePromises);
    allRoutes.push(...allRoutesNested.flat());

    return allRoutes;
  } catch {
    return [];
  }
};

export type { ExtractedTrpcRoute };
export {
  extractHttpMethod,
  extractMethod,
  extractHttpServiceMethod,
  getHttpRoutes,
  extractProcedureType,
  findHandler,
  extractTrpcRoutesFromFile,
  getTrpcRoutes,
};
