import { type CallExpression, Node, type PropertyAssignment, type SourceFile } from 'ts-morph';
import type { RouteHandlerInfo } from '../types';
import { getProject } from '../config';

const getPropertyName = (property: PropertyAssignment): string | undefined => {
  const name = property.getName();

  if (name.startsWith('[') && name.endsWith(']')) {
    return name.slice(1, -1);
  }

  return name;
};

const extractProcedureType = (
  procedureCall: CallExpression,
): 'mutation' | 'query' | 'subscription' => {
  let current: Node | undefined = procedureCall;

  while (current !== undefined) {
    if (Node.isCallExpression(current)) {
      const expression = current.getExpression();

      if (Node.isPropertyAccessExpression(expression)) {
        const propertyName = expression.getName();

        if (propertyName === 'mutation') {
          return 'mutation';
        }

        if (propertyName === 'query') {
          return 'query';
        }

        if (propertyName === 'subscription') {
          return 'subscription';
        }
      }
    }

    current = current.getParent();
  }

  return 'query';
};

const findRouterCalls = (sourceFile: SourceFile): CallExpression[] => {
  const routerCalls: CallExpression[] = [];

  sourceFile.forEachDescendant((node) => {
    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();

      if (Node.isIdentifier(expression) && expression.getText() === 'router') {
        routerCalls.push(node);
      }
    }
  });

  return routerCalls;
};

const findCreateRouteHandlerCall = (expr: CallExpression): CallExpression | undefined => {
  const args = expr.getArguments();

  for (const arg of args) {
    if (Node.isCallExpression(arg)) {
      const argExpression = arg.getExpression();

      if (Node.isIdentifier(argExpression) && argExpression.getText() === 'createRouteHandler') {
        return arg;
      }

      const nestedResult = findCreateRouteHandlerCall(arg);

      if (nestedResult !== undefined) {
        return nestedResult;
      }
    }
  }

  return undefined;
};

const extractServiceInfoFromProcedure = (
  procedureCall: CallExpression,
): {
  procedureType: 'mutation' | 'query' | undefined;
  serviceClass: string | undefined;
  serviceMethod: string | undefined;
} => {
  let serviceClass: string | undefined = undefined;
  let serviceMethod: string | undefined = undefined;

  const extractedType = extractProcedureType(procedureCall);

  const procedureType: 'mutation' | 'query' | undefined =
    extractedType === 'subscription' ? undefined : extractedType;

  const routeHandlerCall = findCreateRouteHandlerCall(procedureCall);

  if (routeHandlerCall !== undefined) {
    const args = routeHandlerCall.getArguments();

    if (args.length >= 2) {
      const [serviceArg, methodArg] = args;

      if (Node.isIdentifier(serviceArg)) {
        serviceClass = serviceArg.getText();
      }

      if (Node.isStringLiteral(methodArg)) {
        serviceMethod = methodArg.getLiteralValue();
      }
    }
  }

  return { procedureType, serviceClass, serviceMethod };
};

const extractRouteFromProperty = (
  property: PropertyAssignment,
  filePath: string,
  routerPrefix: string,
  pathPrefix: string,
): RouteHandlerInfo[] => {
  const routes: RouteHandlerInfo[] = [];

  const propertyName = getPropertyName(property);

  if (propertyName === undefined || propertyName === '') {
    return routes;
  }

  const fullPath = pathPrefix ? `${pathPrefix}.${propertyName}` : propertyName;
  const trpcPath = `/trpc/${routerPrefix}.${fullPath}`;

  const initializer = property.getInitializer();

  if (initializer === undefined) {
    return routes;
  }

  if (Node.isCallExpression(initializer)) {
    const serviceInfo = extractServiceInfoFromProcedure(initializer);

    routes.push({
      handlerFilePath: filePath,
      path: trpcPath,
      procedureType: serviceInfo.procedureType,
      serviceClass: serviceInfo.serviceClass,
      serviceMethod: serviceInfo.serviceMethod,
    });
  } else if (Node.isObjectLiteralExpression(initializer)) {
    for (const nestedProperty of initializer.getProperties()) {
      if (Node.isPropertyAssignment(nestedProperty)) {
        const propertyRoutes = extractRouteFromProperty(
          nestedProperty,
          filePath,
          routerPrefix,
          fullPath,
        );

        routes.push(...propertyRoutes);
      }
    }
  } else if (Node.isIdentifier(initializer)) {
    const routerRef = initializer.getText();

    globalThis.console.log('routerRef', routerRef);

    routes.push({
      handlerFilePath: filePath,
      path: trpcPath,
      serviceClass: undefined,
      serviceMethod: undefined,
    });
  }

  return routes;
};

const extractRoutesFromRouterCall = (
  routerCall: CallExpression,
  filePath: string,
  routerPrefix: string,
): RouteHandlerInfo[] => {
  const routes: RouteHandlerInfo[] = [];

  const args = routerCall.getArguments();

  if (args.length === 0) {
    return routes;
  }

  const [routerConfig] = args;

  if (!Node.isObjectLiteralExpression(routerConfig)) {
    return routes;
  }

  for (const property of routerConfig.getProperties()) {
    if (Node.isPropertyAssignment(property)) {
      const propertyRoutes = extractRouteFromProperty(property, filePath, routerPrefix, '');

      routes.push(...propertyRoutes);
    }
  }

  return routes;
};

const extractTrpcRoutesFromFile = (
  routerFilePath: string,
  routerPrefix: string,
): RouteHandlerInfo[] => {
  const routes: RouteHandlerInfo[] = [];

  try {
    const project = getProject();
    const sourceFile = project.getSourceFile(routerFilePath);

    if (sourceFile === undefined) {
      return routes;
    }

    const routerCalls = findRouterCalls(sourceFile);

    for (const routerCall of routerCalls) {
      const extractedRoutes = extractRoutesFromRouterCall(routerCall, routerFilePath, routerPrefix);

      routes.push(...extractedRoutes);
    }

    return routes;
  } catch {
    return routes;
  }
};

const extractTrpcServiceMethodEnhanced = (procedureName: string): string | undefined => {
  try {
    const parts = procedureName.split('.');

    if (parts.length > 2) {
      return parts.at(-1) ?? undefined;
    }

    if (parts.length === 2) {
      return parts[1];
    }

    if (parts.length === 1) {
      return parts[0];
    }

    return undefined;
  } catch {
    return undefined;
  }
};

const getTrpcRouteObjNameEnhanced = (procedureName: string): string | undefined => {
  try {
    const nameParts = procedureName.split('.');

    if (nameParts.length < 2) {
      return `${nameParts[0]}Routes`;
    }

    const [routePrefix] = nameParts;

    return `${routePrefix}Routes`;
  } catch {
    return undefined;
  }
};

const normalizeTrpcProcedureName = (procedureName: string): string => {
  let normalized = procedureName.trim();

  if (!normalized.includes('.')) {
    normalized = `default.${normalized}`;
  }

  return normalized;
};

const extractTrpcInputSchema = (
  procedureCall: CallExpression,
): Record<string, unknown> | undefined => {
  let current: Node | undefined = procedureCall;

  while (current !== undefined) {
    if (Node.isCallExpression(current)) {
      const expression = current.getExpression();

      if (Node.isPropertyAccessExpression(expression) && expression.getName() === 'input') {
        const args = current.getArguments();

        if (args.length > 0) {
          const [schemaArg] = args;

          return {
            definition: schemaArg.getText(),
            type: 'schema',
          };
        }
      }
    }

    current = current.getParent();
  }

  return undefined;
};

export {
  findRouterCalls,
  findCreateRouteHandlerCall,
  extractRoutesFromRouterCall,
  extractRouteFromProperty,
  extractTrpcRoutesFromFile,
  extractProcedureType,
  extractServiceInfoFromProcedure,
  extractTrpcServiceMethodEnhanced,
  getTrpcRouteObjNameEnhanced,
  normalizeTrpcProcedureName,
  extractTrpcInputSchema,
  getPropertyName,
};
