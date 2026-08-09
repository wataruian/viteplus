import { Node } from 'ts-morph';
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
    if (result !== undefined && result !== '') {
      return result;
    }
  }

  return undefined;
};

const extractHttpServiceMethod = (handlerFilePath: string, path: string): string | undefined => {
  try {
    const project = getProject();
    const sourceFile = project.getSourceFile(handlerFilePath);

    if (sourceFile === undefined) {
      return undefined;
    }

    const exportAssignments = sourceFile.getExportAssignments();
    if (exportAssignments.length === 0) {
      return undefined;
    }

    const [exportAssignment] = exportAssignments;
    let expression = exportAssignment.getExpression();

    if (Node.isIdentifier(expression)) {
      const varDecl = sourceFile.getVariableDeclaration(expression.getText());
      if (varDecl) {
        const init = varDecl.getInitializer();
        if (init) {
          expression = init;
        }
      }
    }

    if (!Node.isObjectLiteralExpression(expression)) {
      return undefined;
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
    });

    if (targetProperty === undefined || !Node.isPropertyAssignment(targetProperty)) {
      return undefined;
    }

    const propertyValue = targetProperty.getInitializer();
    if (propertyValue === undefined) {
      return undefined;
    }

    return extractServiceMethodFromChain(propertyValue);
  } catch {
    return undefined;
  }
};

export { extractServiceMethodFromChain, extractHttpServiceMethod };
