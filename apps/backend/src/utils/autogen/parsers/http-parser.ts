import { Node, type PropertyAssignment } from 'ts-morph';

import { getProject } from '../config';

/**
 * Extract service method from nested call chain
 * Handles: publicHttp.get(() => createRouteHandler(ServiceClass, 'methodName'))
 */
export const extractServiceMethodFromChain = (
  node: Node
): string | undefined => {
  // Look for CallExpression nodes
  if (Node.isCallExpression(node)) {
    const expression = node.getExpression();

    // Check if it's createRouteHandler call
    if (
      Node.isIdentifier(expression) &&
      expression.getText() === 'createRouteHandler'
    ) {
      const args = node.getArguments();
      if (args.length >= 2) {
        // Second argument should be the method name string
        const [, methodArg] = args;
        if (Node.isStringLiteral(methodArg)) {
          return methodArg.getLiteralValue();
        }
      }
    }
  }

  // Recursively search child nodes
  for (const child of node.getChildren()) {
    const result = extractServiceMethodFromChain(child);
    if (result) {
      return result;
    }
  }

  return;
};

/**
 * Extract HTTP service method from route handler
 * Handles HTTP route pattern: export default { '/path': publicHttp.get(() => createRouteHandler(...)) }
 */
export const extractHttpServiceMethod = (
  handlerFilePath: string,
  path: string
): string | undefined => {
  try {
    const project = getProject();
    const sourceFile = project.getSourceFile(handlerFilePath);

    if (!sourceFile) {
      console.warn(`Source file not found: ${handlerFilePath}`);
      return;
    }

    // Find the export default statement
    const [exportAssignment] = sourceFile.getExportAssignments();
    if (!exportAssignment) {
      console.warn(`No export assignment found in ${handlerFilePath}`);
      return;
    }

    const expression = exportAssignment.getExpression();
    if (!Node.isObjectLiteralExpression(expression)) {
      console.warn(`Export is not object literal in ${handlerFilePath}`);
      return;
    }

    // Find the property matching our path
    const targetProperty = expression.getProperties().find(prop => {
      if (Node.isPropertyAssignment(prop)) {
        const nameNode = prop.getNameNode();
        if (Node.isStringLiteral(nameNode)) {
          return nameNode.getLiteralValue() === path;
        }
        if (Node.isIdentifier(nameNode)) {
          return nameNode.getText() === path;
        }
      }
      return false;
    }) as PropertyAssignment | undefined;

    if (!targetProperty) {
      console.warn(
        `Property for path "${path}" not found in ${handlerFilePath}`
      );
      return;
    }

    // Extract service method from the property value
    const propertyValue = targetProperty.getInitializer();
    if (!propertyValue) {
      return;
    }

    return extractServiceMethodFromChain(propertyValue);
  } catch (error) {
    console.error(
      `Error extracting HTTP service method from ${handlerFilePath}:`,
      error
    );
    return;
  }
};

/**
 * Get service method from handler file based on request type
 */
export const getServiceMethodFromHandlerFile = (
  handlerFilePath: string,
  propertyKey: string,
  requestType: 'HTTP' | 'tRPC'
): string | undefined => {
  return requestType === 'HTTP'
    ? extractHttpServiceMethod(handlerFilePath, propertyKey)
    : propertyKey; // For tRPC, the propertyKey is usually the method name
};
