import { type MethodDeclaration, type Node, type ReturnStatement, SyntaxKind } from 'ts-morph';
import type { ParameterInfo, ParameterMetadata, ServiceConstructor } from '../types/parameter';
import { isCallable, isRecord } from '../validators/validate';
import { extractParamNamesAndDefaults } from './invoker';

const extractJsDocDescription = (
  methodDecl: MethodDeclaration,
  paramName: string,
): string | undefined => {
  const jsDocs = methodDecl.getJsDocs();

  if (jsDocs.length === 0) {
    return undefined;
  }

  for (const jsDoc of jsDocs) {
    const tags = jsDoc.getTags();
    for (const tag of tags) {
      if (tag.getTagName() === 'param') {
        const tagText = tag.getText();
        const match = /@param\s+(?:\{[^}]+\}\s+)?(\w+)\s+(.+)/.exec(tagText);

        if (match?.[1] === paramName) {
          return match[2]?.trim();
        }
      }
    }
  }

  return undefined;
};

const extractDefaultValue = (
  initializer: Node | undefined,
): boolean | number | string | undefined | unknown[] => {
  if (!initializer) {
    return undefined;
  }

  const kind = initializer.getKind();

  if (kind === SyntaxKind.ArrayLiteralExpression) {
    try {
      const parsed: unknown = JSON.parse(initializer.getText().replaceAll("'", '"'));
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  if (kind === SyntaxKind.ObjectLiteralExpression) {
    return initializer.getText();
  }

  if (kind === SyntaxKind.FalseKeyword) {
    return false;
  }

  if (kind === SyntaxKind.NumericLiteral) {
    return Number(initializer.getText());
  }

  if (kind === SyntaxKind.StringLiteral) {
    return initializer.getText().slice(1, -1); // Remove quotes
  }

  if (kind === SyntaxKind.TrueKeyword) {
    return true;
  }

  return initializer.getText();
};

const extractReturnTypeDescription = (methodDecl: MethodDeclaration): string | undefined => {
  const jsDocs = methodDecl.getJsDocs();

  if (jsDocs.length === 0) {
    return undefined;
  }

  for (const jsDoc of jsDocs) {
    const tags = jsDoc.getTags();
    for (const tag of tags) {
      const tagName = tag.getTagName();
      if (tagName === 'returns' || tagName === 'return') {
        const tagText = tag.getText();
        const match = /@returns?\s+(?:\{[^}]+\}\s+)?(.+)/.exec(tagText);
        const matchValue = match?.[1];
        const trimmedValue = matchValue?.trim();
        if (trimmedValue !== undefined && trimmedValue !== '') {
          return trimmedValue;
        }
      }
    }
  }

  return undefined;
};

const extractReturnTypeMetadata = (methodDecl: MethodDeclaration): ParameterMetadata[] => {
  const methodName = methodDecl.getName();
  if (methodName.includes('Fail') || methodName.includes('Reject')) {
    return [
      {
        defaultValue: undefined,
        description: undefined,
        name: 'error',
        required: true,
        type: '{ message: string; name: string; stack: string; statusCode: number; }',
      },
      {
        defaultValue: undefined,
        description: undefined,
        name: 'message',
        required: true,
        type: 'string',
      },
    ];
  }

  let returnType = methodDecl.getReturnType();
  const returnTypeText = returnType.getText();

  if (returnType.isUnknown() && methodDecl.isAsync()) {
    const returnStmt = methodDecl
      .getDescendantsOfKind(SyntaxKind.ReturnStatement)
      .find((s): s is ReturnStatement => s.getExpression() !== undefined);
    const returnExpr = returnStmt?.getExpression();
    if (returnExpr !== undefined) {
      returnType = returnExpr.getType();
    }
  }

  if (returnTypeText.startsWith('Promise<')) {
    const typeArgs = returnType.getTypeArguments();
    if (typeArgs.length > 0) {
      const [firstArg] = typeArgs;
      returnType = firstArg;
    }

    if (returnType.getText() === 'unknown' || returnType.getText().startsWith('Promise<')) {
      const returnStmt = methodDecl
        .getDescendantsOfKind(SyntaxKind.ReturnStatement)
        .find((s): s is ReturnStatement => s.getExpression() !== undefined);
      const returnExpr = returnStmt?.getExpression();
      if (returnExpr !== undefined) {
        returnType = returnExpr.getType();
      }
    }
  }

  const isObjectLiteral =
    returnType.isObject() &&
    !returnType.isArray() &&
    !returnType.isVoid() &&
    returnType.getText() !== 'void' &&
    !returnType.getText().startsWith('Array<') &&
    !returnType.getText().endsWith('[]');

  if (isObjectLiteral) {
    const props = returnType.getProperties();
    if (props.length > 0) {
      return props.map((prop) => {
        const name = prop.getName();
        const typeAtLoc = returnType.getProperty(name)?.getTypeAtLocation(methodDecl);
        return {
          defaultValue: undefined,
          description: undefined,
          name,
          required: !prop.isOptional(),
          type: typeAtLoc?.getText() ?? 'unknown',
        };
      });
    }
  }

  return [
    {
      description: extractReturnTypeDescription(methodDecl),
      name: 'output',
      type: returnType.getText(),
    },
  ];
};

const fallbackToAstOnly = (methodDecl: MethodDeclaration): ParameterMetadata[] =>
  methodDecl.getParameters().map((param) => ({
    defaultValue: extractDefaultValue(param.getInitializer()),
    description: extractJsDocDescription(methodDecl, param.getName()),
    name: param.getName(),
    required: !param.isOptional(),
    type: param.getType().getText(),
  }));

const isServiceConstructor = (val: unknown): val is ServiceConstructor => typeof val === 'function';

const extractParameterMetadata = async (
  methodDecl: MethodDeclaration,
  serviceFilePath: string,
  serviceClassName: string,
  methodName: string,
): Promise<ParameterMetadata[]> => {
  try {
    const serviceModule: unknown = await import(serviceFilePath);
    if (!isRecord(serviceModule)) {
      return fallbackToAstOnly(methodDecl);
    }

    const ServiceClass = serviceModule[serviceClassName];

    if (!isServiceConstructor(ServiceClass)) {
      return fallbackToAstOnly(methodDecl);
    }

    const dummyContext = {
      req: {},
      res: {},
    };
    const instance: Record<string, unknown> = new ServiceClass(dummyContext, {});
    const runtimeMethod = instance[methodName];

    if (!isCallable(runtimeMethod)) {
      return fallbackToAstOnly(methodDecl);
    }

    const invokerParams: ParameterInfo[] = extractParamNamesAndDefaults(runtimeMethod);

    const astParams = methodDecl.getParameters();

    const mergedParams: ParameterMetadata[] = invokerParams.map((invokerParam, i) => {
      const astParam = astParams[i];

      if (i >= astParams.length) {
        return {
          name: invokerParam.name,
          required: true,
          type: 'unknown',
        };
      }

      return {
        defaultValue: extractDefaultValue(astParam.getInitializer()),
        description: extractJsDocDescription(methodDecl, invokerParam.name),
        name: invokerParam.name,
        required: !astParam.isOptional(),
        type: astParam.getType().getText(),
      };
    });

    return mergedParams;
  } catch {
    return fallbackToAstOnly(methodDecl);
  }
};

export {
  extractJsDocDescription,
  extractReturnTypeDescription,
  extractReturnTypeMetadata,
  isServiceConstructor,
  extractDefaultValue,
  fallbackToAstOnly,
  extractParameterMetadata,
};
