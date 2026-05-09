import { type MethodDeclaration, type Node, SyntaxKind } from 'ts-morph';
import type { ParameterInfo, ParameterMetadata } from '../types/parameter';
import { isCallable, isRecord } from '../validators/validate';
import { extractParamNamesAndDefaults } from './invoker';

/**
 * Extract JSDoc description for a parameter from the method's JSDoc
 * Parses @param tags to find documentation for specific parameters
 */
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

/**
 * Extract default value from AST initializer node
 * Handles: primitives, objects, arrays, booleans
 */
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

/**
 * Fallback to AST-only parameter extraction if invoker fails
 * This maintains backward compatibility but loses runtime consistency guarantee
 */
const fallbackToAstOnly = (methodDecl: MethodDeclaration): ParameterMetadata[] =>
  methodDecl.getParameters().map((param) => ({
    defaultValue: extractDefaultValue(param.getInitializer()),
    description: extractJsDocDescription(methodDecl, param.getName()),
    name: param.getName(),
    required: !param.isOptional(),
    type: param.getType().getText(),
  }));

type ServiceConstructor = new (...args: unknown[]) => Record<string, unknown>;

const isServiceConstructor = (val: unknown): val is ServiceConstructor => typeof val === 'function';

/**
 * Extract parameter metadata using hybrid approach:
 * - Invoker for parameter names (ensures runtime consistency)
 * - AST for type information, optional markers, defaults, JSDoc
 *
 * @param methodDecl - The ts-morph method declaration node
 * @param serviceFilePath - Path to the service file
 * @param serviceClassName - Name of the service class
 * @param methodName - Name of the method
 * @returns Array of parameter metadata
 */
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

export type { ServiceConstructor };
export {
  extractJsDocDescription,
  isServiceConstructor,
  extractDefaultValue,
  fallbackToAstOnly,
  extractParameterMetadata,
};
