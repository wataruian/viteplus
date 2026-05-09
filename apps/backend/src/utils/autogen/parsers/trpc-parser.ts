import type {
  CallExpression,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
} from 'ts-morph';

import { Node } from 'ts-morph';
import { getProject } from '../config';
import type { RouteHandlerInfo } from '../types';

/**
 * Enhanced tRPC method extraction using AST traversal
 * Handles complex patterns like nested routers, conditional routes, and dynamic method generation
 */

/**
 * Extract tRPC routes from router files using AST traversal
 * This replaces the regex-based approach with proper TypeScript AST parsing
 */
const extractTrpcRoutesFromFile = (
  routerFilePath: string,
  routerPrefix: string
): RouteHandlerInfo[] => {
  const routes: RouteHandlerInfo[] = [];

  try {
    const project = getProject();
    const sourceFile = project.getSourceFile(routerFilePath);
    if (!sourceFile) {
      return routes;
    }

    // Find router object literals (e.g., router({...}))
    const routerCalls = findRouterCalls(sourceFile);

    for (const routerCall of routerCalls) {
      const extractedRoutes = extractRoutesFromRouterCall(
        routerCall,
        routerFilePath,
        routerPrefix
      );
      routes.push(...extractedRoutes);
    }

    return routes;
  } catch (error) {
    console.error(`Error parsing tRPC router file ${routerFilePath}:`, error);
    return routes;
  }
};

/**
 * Find all router() function calls in the source file
 */
const findRouterCalls = (sourceFile: SourceFile): CallExpression[] => {
  const routerCalls: CallExpression[] = [];

  sourceFile.forEachDescendant(node => {
    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();

      // Check if this is a router() call
      if (Node.isIdentifier(expression) && expression.getText() === 'router') {
        routerCalls.push(node);
      }
    }
  });

  return routerCalls;
};

/**
 * Extract routes from a router() call expression
 */
const extractRoutesFromRouterCall = (
  routerCall: CallExpression,
  filePath: string,
  routerPrefix: string
): RouteHandlerInfo[] => {
  const routes: RouteHandlerInfo[] = [];

  // Get the first argument (should be an object literal)
  const args = routerCall.getArguments();
  if (args.length === 0) {
    return routes;
  }

  const [routerConfig] = args;
  if (!Node.isObjectLiteralExpression(routerConfig)) {
    return routes;
  }

  // Extract routes from object properties
  const extractedRoutes = extractRoutesFromObjectLiteral(
    routerConfig,
    filePath,
    routerPrefix
  );

  routes.push(...extractedRoutes);
  return routes;
};

/**
 * Extract routes from an object literal expression
 * Handles both simple property assignments and computed properties
 */
const extractRoutesFromObjectLiteral = (
  objectExpr: ObjectLiteralExpression,
  filePath: string,
  routerPrefix: string,
  pathPrefix = ''
): RouteHandlerInfo[] => {
  const routes: RouteHandlerInfo[] = [];

  for (const property of objectExpr.getProperties()) {
    if (Node.isPropertyAssignment(property)) {
      const extractedRoutes = extractRouteFromProperty(
        property,
        filePath,
        routerPrefix,
        pathPrefix
      );
      routes.push(...extractedRoutes);
    }
    // Handle other property types if needed (getters, setters, methods, etc.)
  }

  return routes;
};

/**
 * Extract route information from a property assignment
 */
const extractRouteFromProperty = (
  property: PropertyAssignment,
  filePath: string,
  routerPrefix: string,
  pathPrefix: string
): RouteHandlerInfo[] => {
  const routes: RouteHandlerInfo[] = [];

  // Get property name (route method name)
  const propertyName = getPropertyName(property);
  if (!propertyName) {
    return routes;
  }

  const fullPath = pathPrefix ? `${pathPrefix}.${propertyName}` : propertyName;
  const trpcPath = `/trpc/${routerPrefix}.${fullPath}`;

  // Get property value
  const initializer = property.getInitializer();
  if (!initializer) {
    return routes;
  }

  // Handle different types of property values
  if (Node.isCallExpression(initializer)) {
    // Handle procedure calls (publicProcedure.query(...), etc.)
    const serviceInfo = extractServiceInfoFromProcedure(initializer);

    routes.push({
      handlerFilePath: filePath,
      path: trpcPath,
      procedureType: serviceInfo.procedureType,
      serviceClass: serviceInfo.serviceClass,
      serviceMethod: serviceInfo.serviceMethod,
    });
  } else if (Node.isObjectLiteralExpression(initializer)) {
    // Handle nested router objects
    const nestedRoutes = extractRoutesFromObjectLiteral(
      initializer,
      filePath,
      routerPrefix,
      fullPath
    );
    routes.push(...nestedRoutes);
  } else if (Node.isIdentifier(initializer)) {
    // Handle router references (imported routers)
    // This would require additional logic to resolve imports
    const routerRef = initializer.getText();
    console.log(`Found router reference: ${routerRef} for path: ${trpcPath}`);

    // For now, create a basic route entry
    routes.push({
      handlerFilePath: filePath,
      path: trpcPath,
      serviceClass: undefined,
      serviceMethod: undefined,
    });
  }

  return routes;
};

/**
 * Get property name from property assignment, handling both identifiers and computed properties
 */
const getPropertyName = (property: PropertyAssignment): string | undefined => {
  const name = property.getName();

  // Handle computed properties [key]: value
  if (name.startsWith('[') && name.endsWith(']')) {
    // For computed properties, try to extract the actual value
    // This is complex and might need more sophisticated handling
    return name.slice(1, -1);
  }

  return name;
};

/**
 * Extract service information from procedure call expressions
 * Looks for createRouteHandler(ServiceClass, 'methodName') patterns
 * Also extracts procedure type (query/mutation)
 */
const extractServiceInfoFromProcedure = (
  procedureCall: CallExpression
): {
  procedureType: 'mutation' | 'query' | undefined;
  serviceClass: string | undefined;
  serviceMethod: string | undefined;
} => {
  let serviceClass: string | undefined;
  let serviceMethod: string | undefined;

  // Extract procedure type from the call chain
  const extractedType = extractProcedureType(procedureCall);
  const procedureType: 'mutation' | 'query' | undefined =
    extractedType === 'subscription' ? undefined : extractedType;

  // Traverse the call chain to find createRouteHandler calls
  const routeHandlerCall = findCreateRouteHandlerCall(procedureCall);

  if (routeHandlerCall) {
    const args = routeHandlerCall.getArguments();

    if (args.length >= 2) {
      // Destructure arguments: Service class and method name
      const [serviceArg, methodArg] = args;
      if (Node.isIdentifier(serviceArg)) {
        serviceClass = serviceArg.getText();
      }

      // Second argument: Method name (usually string literal)
      if (Node.isStringLiteral(methodArg)) {
        serviceMethod = methodArg.getLiteralValue();
      }
    }
  }

  return { procedureType, serviceClass, serviceMethod };
};

/**
 * Find createRouteHandler call in a procedure call chain
 * Handles patterns like: publicProcedure.query(createRouteHandler(...))
 */
const findCreateRouteHandlerCall = (
  expr: CallExpression
): CallExpression | undefined => {
  // Check if this call expression contains createRouteHandler
  const args = expr.getArguments();

  for (const arg of args) {
    if (Node.isCallExpression(arg)) {
      const argExpression = arg.getExpression();

      if (
        Node.isIdentifier(argExpression) &&
        argExpression.getText() === 'createRouteHandler'
      ) {
        return arg;
      }

      // Recursively check nested calls
      const nestedResult = findCreateRouteHandlerCall(arg);
      if (nestedResult) {
        return nestedResult;
      }
    }
  }

  return;
};

/**
 * Extract tRPC procedure type (query, mutation, subscription)
 * from procedure call chain
 */
const extractProcedureType = (
  procedureCall: CallExpression
): 'mutation' | 'query' | 'subscription' => {
  // Walk up the call chain to find the procedure type
  let current: Node = procedureCall;

  while (current) {
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

    // Move up the AST
    const parent = current.getParent();
    if (!parent) {
      break;
    }
    current = parent;
  }

  return 'query'; // default fallback
};

/**
 * Enhanced service method extraction with fallback to regex approach
 */
const extractTrpcServiceMethodEnhanced = (
  procedureName: string
): string | undefined => {
  try {
    // Enhanced logic: handle more complex patterns
    const parts = procedureName.split('.');

    // Handle nested namespaces: 'api.v1.users.getProfile' -> 'getProfile'
    if (parts.length > 2) {
      return parts.at(-1) || undefined;
    }

    // Handle simple case: 'test.hello' -> 'hello'
    if (parts.length === 2) {
      return parts[1];
    }

    // Handle single method: 'root' -> 'root'
    if (parts.length === 1) {
      return parts[0];
    }

    return;
  } catch {
    return;
  }
};

/**
 * Enhanced route object name extraction with support for nested routers
 */
const getTrpcRouteObjNameEnhanced = (
  procedureName: string
): string | undefined => {
  try {
    const nameParts = procedureName.split('.');

    if (nameParts.length < 2) {
      // Handle single-level routes
      return `${nameParts[0]}Routes`;
    }

    // For nested routes, use the first part as the main router
    const [routePrefix] = nameParts;
    return `${routePrefix}Routes`;
  } catch {
    return;
  }
};

/**
 * Validate and normalize tRPC procedure names
 */
const normalizeTrpcProcedureName = (procedureName: string): string => {
  // Remove any leading/trailing whitespace
  let normalized = procedureName.trim();

  // Handle edge cases and normalize format
  if (!normalized.includes('.')) {
    // Single method name, assume it's under 'default' namespace
    normalized = `default.${normalized}`;
  }

  return normalized;
};

/**
 * Extract input schema information from tRPC procedure definitions
 * This can be used for enhanced parameter extraction
 */
const extractTrpcInputSchema = (
  procedureCall: CallExpression
): Record<string, unknown> | undefined => {
  // Look for .input() calls in the procedure chain
  let current: Node = procedureCall;

  while (current) {
    if (Node.isCallExpression(current)) {
      const expression = current.getExpression();

      if (
        Node.isPropertyAccessExpression(expression) &&
        expression.getName() === 'input'
      ) {
        // Get the input schema argument
        const args = current.getArguments();
        if (args.length > 0) {
          const [schemaArg] = args;
          if (schemaArg) {
            // Here we could parse Zod schemas or other validation schemas
            // For now, return basic information
            return {
              definition: schemaArg.getText(),
              type: 'schema',
            };
          }
        }
      }
    }

    const parent = current.getParent();
    if (!parent) {
      break;
    }
    current = parent;
  }

  return;
};

export {
  extractTrpcRoutesFromFile,
  extractProcedureType,
  extractTrpcServiceMethodEnhanced,
  getTrpcRouteObjNameEnhanced,
  normalizeTrpcProcedureName,
  extractTrpcInputSchema,
};
