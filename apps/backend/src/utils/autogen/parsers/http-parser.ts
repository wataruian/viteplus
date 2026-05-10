import { Node, type PropertyAssignment } from 'ts-morph';
import { getProject } from '../config';

const extractServiceMethodFromChain = (node: Node): string | undefined => {
  if (Node.isCallExpression(node)) {
    const expression = node.getExpression();

    if (Node.isIdentifier(expression) && expression.getText() === 'createRouteHandler') {
      const args = node.getArguments();
      if (args.length >= 2) {
        const [, methodArg] = args;
        if (Node.isStringLiteral(methodArg)) {
          return methodArg.getLiteralValue();
        }
      }
    }
  }

  for (const child of node.getChildren()) {
    const result = extractServiceMethodFromChain(child);
    if (result) {
      return result;
    }
  }

  return undefined;
};

const extractHttpServiceMethod = (handlerFilePath: string, path: string): string | undefined => {
  try {
    const project = getProject();
    const sourceFile = project.getSourceFile(handlerFilePath);

    if (!sourceFile) {
      return;
    }

    const [exportAssignment] = sourceFile.getExportAssignments();
    if (!exportAssignment) {
      return;
    }

    const expression = exportAssignment.getExpression();
    if (!Node.isObjectLiteralExpression(expression)) {
      return;
    }

    const targetProperty = expression.getProperties().find((prop) => {
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
      return;
    }

    const propertyValue = targetProperty.getInitializer();
    if (!propertyValue) {
      return;
    }

    return extractServiceMethodFromChain(propertyValue);
  } catch {
    return undefined;
  }
};

const getServiceMethodFromHandlerFile = (
  handlerFilePath: string,
  propertyKey: string,
  requestType: 'HTTP' | 'tRPC',
): string | undefined =>
  requestType === 'HTTP' ? extractHttpServiceMethod(handlerFilePath, propertyKey) : propertyKey;

export { extractServiceMethodFromChain, extractHttpServiceMethod, getServiceMethodFromHandlerFile };
