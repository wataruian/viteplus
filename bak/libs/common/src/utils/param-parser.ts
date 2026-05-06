import type { MethodDeclaration, Node } from 'ts-morph';

import { SyntaxKind } from 'ts-morph';

import type { ParameterInfo, ParameterMetadata } from '../types/parameter';

import { extractParamNamesAndDefaults } from './invoker';

// Regex for parsing @param JSDoc tags
const PARAM_TAG_REGEX = /@param\s+(?:\{[^}]+\}\s+)?(\w+)\s+(.+)/;

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
async function extractParameterMetadata(
  methodDecl: MethodDeclaration,
  serviceFilePath: string,
  serviceClassName: string,
  methodName: string
): Promise<ParameterMetadata[]> {
  try {
    // Step 1: Get runtime function via dynamic import
    const serviceModule = await import(serviceFilePath);
    const ServiceClass = serviceModule[serviceClassName];

    if (!ServiceClass) {
      console.warn(
        `Service class ${serviceClassName} not found in ${serviceFilePath}`
      );
      return fallbackToAstOnly(methodDecl);
    }

    // Create a dummy instance to get the method
    const dummyContext = {
      req: {} as never,
      res: {} as never,
    };
    const instance = new ServiceClass(dummyContext, {});
    const runtimeMethod = instance[methodName];

    if (typeof runtimeMethod !== 'function') {
      console.warn(`Method ${methodName} is not a function`);
      return fallbackToAstOnly(methodDecl);
    }

    // Step 2: Extract param names via invoker (TRUTH SOURCE for names)
    const invokerParams: ParameterInfo[] =
      extractParamNamesAndDefaults(runtimeMethod);

    // Step 3: Get TypeScript type info via AST
    const astParams = methodDecl.getParameters();

    // Step 4: Merge invoker names + AST type info + JSDoc
    const mergedParams: ParameterMetadata[] = invokerParams.map(
      (invokerParam, i) => {
        const astParam = astParams[i];

        if (!astParam) {
          // Invoker found param but AST didn't - shouldn't happen but handle it
          return {
            name: invokerParam.name,
            required: true,
            type: 'unknown',
          };
        }

        return {
          defaultValue: extractDefaultValue(astParam.getInitializer()), // From AST
          description: extractJsDocDescription(methodDecl, invokerParam.name), // From JSDoc
          name: invokerParam.name, // From INVOKER (guaranteed runtime match)
          required: !astParam.isOptional(), // From AST
          type: astParam.getType().getText(), // From AST
        };
      }
    );

    return mergedParams;
  } catch (error) {
    console.error(
      `Error extracting params for ${serviceClassName}.${methodName}:`,
      error
    );
    // Fallback to AST-only extraction
    return fallbackToAstOnly(methodDecl);
  }
}

/**
 * Extract default value from AST initializer node
 * Handles: primitives, objects, arrays, booleans
 */
function extractDefaultValue(
  initializer: Node | undefined
): boolean | number | string | undefined | unknown[] {
  if (!initializer) {
    return;
  }

  const kind = initializer.getKind();

  switch (kind) {
    case SyntaxKind.ArrayLiteralExpression: {
      try {
        return JSON.parse(initializer.getText().replaceAll("'", '"'));
      } catch {
        return;
      }
    }
    case SyntaxKind.FalseKeyword: {
      return false;
    }
    case SyntaxKind.NumericLiteral: {
      return Number(initializer.getText());
    }
    case SyntaxKind.ObjectLiteralExpression: {
      try {
        return JSON.parse(initializer.getText().replaceAll("'", '"'));
      } catch {
        return;
      }
    }
    case SyntaxKind.StringLiteral: {
      return initializer.getText().slice(1, -1); // Remove quotes
    }
    case SyntaxKind.TrueKeyword: {
      return true;
    }
    default: {
      return initializer.getText(); // Fallback: return as string
    }
  }
}

/**
 * Extract JSDoc description for a parameter from the method's JSDoc
 * Parses @param tags to find documentation for specific parameters
 */
function extractJsDocDescription(
  methodDecl: MethodDeclaration,
  paramName: string
): string | undefined {
  const jsDocs = methodDecl.getJsDocs();

  if (jsDocs.length === 0) {
    return;
  }

  // Look through all JSDoc blocks
  for (const jsDoc of jsDocs) {
    const tags = jsDoc.getTags();

    // Find @param tag matching our parameter name
    for (const tag of tags) {
      if (tag.getTagName() === 'param') {
        const tagText = tag.getText();
        // Match @param paramName or @param {type} paramName
        const match = tagText.match(PARAM_TAG_REGEX);

        if (match && match[1] === paramName) {
          return match[2]?.trim();
        }
      }
    }
  }

  return;
}

/**
 * Fallback to AST-only parameter extraction if invoker fails
 * This maintains backward compatibility but loses runtime consistency guarantee
 */
function fallbackToAstOnly(methodDecl: MethodDeclaration): ParameterMetadata[] {
  return methodDecl.getParameters().map(param => ({
    defaultValue: extractDefaultValue(param.getInitializer()),
    description: extractJsDocDescription(methodDecl, param.getName()),
    name: param.getName(),
    required: !param.isOptional(),
    type: param.getType().getText(),
  }));
}

export { extractParameterMetadata };
