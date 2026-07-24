// import { type MethodDeclaration, type Node, type ReturnStatement, SyntaxKind } from 'ts-morph';
import { type MethodDeclaration, Node, SyntaxKind } from 'ts-morph';
import type { ParameterInfo, ParameterMetadata, ServiceConstructor } from '../types/parameter';
import { isCallable, isRecord } from '../validators/validate';
import { extractParamNamesAndDefaults } from './invoker';

interface ParsedType {
  base?: string;
  itemType?: ParsedType | string;
  kind: 'array' | 'object' | 'primitive' | 'union';
  properties?: Record<string, ParsedType | string>;
  types?: (ParsedType | string)[];
  required?: boolean;
}

interface SerializedType {
  kind: 'object' | 'array' | 'primitive' | 'union';
  base?: string;
  itemType?: SerializedType;
  properties?: Record<string, SerializedType>;
  types?: SerializedType[];
  required?: boolean;
}

const areSerializedTypesEqual = (left: SerializedType, right: SerializedType): boolean => {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.base !== right.base) {
    return false;
  }

  if (left.kind === 'primitive') {
    return true;
  }

  if (left.kind === 'array') {
    return areSerializedTypesEqual(
      left.itemType ?? { base: 'unknown', kind: 'primitive' },
      right.itemType ?? { base: 'unknown', kind: 'primitive' },
    );
  }

  if (left.kind === 'object') {
    const leftProps = left.properties ?? {};
    const rightProps = right.properties ?? {};
    const leftKeys = Object.keys(leftProps);
    const rightKeys = Object.keys(rightProps);

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    return leftKeys.every(
      (key) => rightKeys.includes(key) && areSerializedTypesEqual(leftProps[key], rightProps[key]),
    );
  }

  if (left.kind === 'union') {
    return (
      (left.types ?? []).length === (right.types ?? []).length &&
      (left.types ?? []).every((type, index) =>
        areSerializedTypesEqual(
          type,
          right.types?.[index] ?? { base: 'unknown', kind: 'primitive' },
        ),
      )
    );
  }

  return true;
};

const isUndefinedLikeType = (type: Type): boolean => {
  const text = type.getText().trim();
  return type.isUndefined() || text === 'undefined' || text === 'void';
};

const mergeSerializedTypes = (types: SerializedType[]): SerializedType => {
  if (types.length === 0) {
    return { base: 'unknown', kind: 'primitive' };
  }

  if (types.length === 1) {
    return types[0];
  }

  const uniqueTypes = types.filter(
    (type, index, array) =>
      array.findIndex((candidate) => areSerializedTypesEqual(candidate, type)) === index,
  );

  if (uniqueTypes.length === 1) {
    return uniqueTypes[0];
  }

  return {
    kind: 'union',
    types: uniqueTypes,
  };
};

function serializeType(type: Type): SerializedType {
  const text = type.getText();

  // -------------------------
  // primitives
  // -------------------------
  if (type.isString()) {
    return { base: 'string', kind: 'primitive' };
  }
  if (type.isNumber()) {
    return { base: 'number', kind: 'primitive' };
  }
  if (type.isBoolean()) {
    return { base: 'boolean', kind: 'primitive' };
  }
  if (type.isUndefined()) {
    return { base: 'undefined', kind: 'primitive' };
  }
  if (type.isNull()) {
    return { base: 'null', kind: 'primitive' };
  }

  // -------------------------
  // arrays
  // -------------------------
  const element = type.getArrayElementType();
  if (element) {
    return {
      itemType: serializeType(element),
      kind: 'array',
    };
  }

  if (type.isArray()) {
    const arg = type.getTypeArguments()[0];
    return {
      itemType: arg ? serializeType(arg) : { base: 'unknown', kind: 'primitive' },
      kind: 'array',
    };
  }

  if (text.startsWith('Array<') && text.endsWith('>')) {
    const arg = type.getTypeArguments()[0];
    if (arg) {
      return {
        itemType: serializeType(arg),
        kind: 'array',
      };
    }
  }

  if (text.endsWith('[]')) {
    return parseTypeString(text) as SerializedType;
  }

  // -------------------------
  // union
  // -------------------------
  if (type.isUnion()) {
    return {
      kind: 'union',
      types: type
        .getUnionTypes()
        .filter((t) => !isUndefinedLikeType(t))
        .map((t) => serializeType(t)),
    };
  }

  // -------------------------
  // object
  // -------------------------
  if (type.isObject() && !type.isArray()) {
    const props: Record<string, SerializedType> = {};

    for (const symbol of type.getProperties()) {
      const decl = symbol.getDeclarations()?.[0];
      if (!decl) {
        continue;
      }

      const propType = decl.getType();
      const serialized = serializeType(propType);
      serialized.required = !symbol.isOptional();
      props[symbol.getName()] = serialized;
    }

    return {
      kind: 'object',
      properties: props,
    };
  }

  // -------------------------
  // fallback
  // -------------------------
  return {
    base: text,
    kind: 'primitive',
  };
}

const getParamOrVarTypeName = (node: Identifier): string | undefined => {
  const defs = node.getDefinitionNodes?.() ?? [];
  for (const def of defs) {
    if (Node.isParameterDeclaration(def) || Node.isVariableDeclaration(def)) {
      const typeNode = def.getTypeNode();
      if (typeNode) {
        return typeNode.getText().trim();
      }
    }
  }
  return undefined;
};

const resolveIdentifierType = (node: Identifier): Type => {
  const defs = node.getDefinitionNodes?.() ?? [];

  for (const def of defs) {
    // function parameter → REAL SOURCE OF TRUTH
    if (Node.isParameterDeclaration(def)) {
      return def.getType();
    }

    // local variable fallback
    if (Node.isVariableDeclaration(def)) {
      return def.getType();
    }
  }

  // fallback (last resort)
  return node.getType();
};

const serializeObject = (node: ObjectLiteralExpression): SerializedType => {
  const properties: Record<string, SerializedType> = {};

  for (const prop of node.getProperties()) {
    // { a: value }
    if (Node.isPropertyAssignment(prop)) {
      const name = prop.getName();
      const init = prop.getInitializer();

      if (!init) {
        continue;
      }

      properties[name] = serializeNode(init);
    }

    // { a }
    if (Node.isShorthandPropertyAssignment(prop)) {
      const name = prop.getName();
      const id = prop.getNameNode();

      properties[name] = serializeNode(id);
    }
  }

  return {
    kind: 'object',
    properties,
  };
};

const serializeFromType = (type: Type, node: Node): SerializedType => {
  const text = type.getText(node);
  // ----------------------------
  // PRIMITIVES
  // ----------------------------
  if (type.isString() || type.isStringLiteral()) {
    return { base: 'string', kind: 'primitive' };
  }

  if (type.isNumber() || type.isNumberLiteral()) {
    return { base: 'number', kind: 'primitive' };
  }

  if (type.isBoolean() || type.isBooleanLiteral()) {
    return { base: 'boolean', kind: 'primitive' };
  }

  if (type.isUndefined()) {
    return { base: 'undefined', kind: 'primitive' };
  }

  if (type.isNull()) {
    return { base: 'null', kind: 'primitive' };
  }

  // ----------------------------
  // ARRAY
  // ----------------------------
  const elementType = type.getArrayElementType();
  if (elementType) {
    return {
      itemType: serializeFromType(elementType, node),
      kind: 'array',
    };
  }

  if (type.isArray()) {
    const t = type.getTypeArguments?.()?.[0];
    return {
      itemType: t ? serializeFromType(t, node) : { base: 'unknown', kind: 'primitive' },
      kind: 'array',
    };
  }

  if (text.startsWith('Array<') && text.endsWith('>')) {
    const t = type.getTypeArguments?.()?.[0];
    return {
      itemType: t ? serializeFromType(t, node) : { base: 'unknown', kind: 'primitive' },
      kind: 'array',
    };
  }

  if (text.endsWith('[]')) {
    return parseTypeString(text) as SerializedType;
  }

  // ----------------------------
  // UNION (SAFE)
  // ----------------------------
  if (type.isUnion()) {
    const filtered = type.getUnionTypes().filter((t) => !isUndefinedLikeType(t));

    if (filtered.length === 1) {
      return serializeFromType(filtered[0], node);
    }

    return {
      kind: 'union',
      types: filtered.map((t) => serializeFromType(t, node)),
    };
  }

  // ----------------------------
  // OBJECT TYPE (NO getProperties fallback issues)
  // ----------------------------
  if (type.isObject() && !type.isArray()) {
    const props: Record<string, SerializedType> = {};

    for (const symbol of type.getProperties()) {
      const decl = symbol.getDeclarations()?.[0];
      if (!decl) {
        continue;
      }

      const propType = decl.getType();
      const serialized = serializeFromType(propType, decl);
      serialized.required = !symbol.isOptional();
      props[symbol.getName()] = serialized;
    }

    return {
      kind: 'object',
      properties: props,
    };
  }

  // ----------------------------
  // FALLBACK
  // ----------------------------
  return {
    base: text,
    kind: 'primitive',
  };
};

const serializeArrayLiteral = (node: Node): SerializedType => {
  if (!Node.isArrayLiteralExpression(node)) {
    return { itemType: { base: 'unknown', kind: 'primitive' }, kind: 'array' };
  }

  const elements = node.getElements();

  if (elements.length === 0) {
    return { itemType: { base: 'unknown', kind: 'primitive' }, kind: 'array' };
  }

  return {
    itemType: mergeSerializedTypes(elements.map((element) => serializeExpression(element))),
    kind: 'array',
  };
};

const serializeNode = (node: Node): SerializedType => {
  if (Node.isArrayLiteralExpression(node)) {
    return serializeArrayLiteral(node);
  }

  // ----------------------------
  // OBJECT LITERAL (IMPORTANT)
  // ----------------------------
  if (Node.isObjectLiteralExpression(node)) {
    return serializeObject(node);
  }

  // ----------------------------
  // IDENTIFIER RESOLUTION (🔥 FIX FOR var3)
  // ----------------------------
  if (Node.isIdentifier(node)) {
    const typeName = getParamOrVarTypeName(node);
    if (typeName) {
      const parsed = parseTypeString(typeName);
      if (typeof parsed === 'object' && parsed.kind === 'array') {
        return parsed as SerializedType;
      }
    }
    return serializeFromType(resolveIdentifierType(node), node);
  }

  // ----------------------------
  // TYPE BASED FALLBACK
  // ----------------------------
  const type = node.getType();
  return serializeFromType(type, node);
};

const serializeObjectLiteral = (node: ObjectLiteralExpression): SerializedType => {
  const properties: Record<string, SerializedType> = {};

  for (const prop of node.getProperties()) {
    // normal: { a: x }
    if (Node.isPropertyAssignment(prop)) {
      const name = prop.getName();
      const init = prop.getInitializer();

      if (!init) {
        continue;
      }

      properties[name] = serializeExpression(init);
    }

    // shorthand: { var3 }
    if (Node.isShorthandPropertyAssignment(prop)) {
      const name = prop.getName();
      const identifier = prop.getNameNode();

      properties[name] = serializeExpression(identifier);
    }
  }

  return {
    kind: 'object',
    properties,
  };
};

const serializeExpression = (node: Node): SerializedType => {
  if (Node.isArrayLiteralExpression(node)) {
    return serializeArrayLiteral(node);
  }

  if (Node.isObjectLiteralExpression(node)) {
    return serializeObjectLiteral(node);
  }

  if (Node.isIdentifier(node)) {
    const typeName = getParamOrVarTypeName(node);
    if (typeName) {
      const parsed = parseTypeString(typeName);
      if (typeof parsed === 'object' && parsed.kind === 'array') {
        return parsed as SerializedType;
      }
    }
    return serializeFromType(resolveIdentifierType(node), node);
  }

  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return { base: 'string', kind: 'primitive' };
  }

  if (Node.isNumericLiteral(node)) {
    return { base: 'number', kind: 'primitive' };
  }

  if (node.getKind() === SyntaxKind.TrueKeyword || node.getKind() === SyntaxKind.FalseKeyword) {
    return { base: 'boolean', kind: 'primitive' };
  }

  if (node.getKind() === SyntaxKind.NullKeyword) {
    return { base: 'null', kind: 'primitive' };
  }

  const type = node.getType();
  const text = type.getText(node);

  // --------------------------
  // primitives
  // --------------------------

  if (type.isString() || type.isStringLiteral()) {
    return { base: 'string', kind: 'primitive' };
  }

  if (type.isNumber() || type.isNumberLiteral()) {
    return { base: 'number', kind: 'primitive' };
  }

  if (type.isBoolean() || type.isBooleanLiteral()) {
    return { base: 'boolean', kind: 'primitive' };
  }

  if (type.isUndefined()) {
    return { base: 'undefined', kind: 'primitive' };
  }

  if (type.isNull()) {
    return { base: 'null', kind: 'primitive' };
  }

  // --------------------------
  // arrays
  // --------------------------

  const arr = type.getArrayElementType();
  if (arr) {
    return {
      itemType: serializeFromType(arr, node),
      kind: 'array',
    };
  }

  if (text.endsWith('[]') || text.startsWith('Array<') || text.startsWith('ReadonlyArray<')) {
    const inner = type.getTypeArguments()?.[0];

    return {
      itemType: inner ? serializeFromType(inner, node) : { base: 'unknown', kind: 'primitive' },
      kind: 'array',
    };
  }

  if (type.getProperties().length > 0 && !type.isArray()) {
    return serializeFromType(type, node);
  }

  // --------------------------
  // union
  // --------------------------

  if (type.isUnion()) {
    const filtered = type.getUnionTypes().filter((t) => !isUndefinedLikeType(t));

    if (filtered.length === 1) {
      return serializeFromType(filtered[0], node);
    }

    return {
      kind: 'union',
      types: filtered.map((t) => serializeFromType(t, node)),
    };
  }

  // --------------------------
  // fallback
  // --------------------------

  return {
    base: text,
    kind: 'primitive',
  };
};

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

const parseObjectLiteral = (objectText: string): Record<string, unknown> | string => {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${objectText})`);
    const result: unknown = fn();
    return typeof result === 'object' && result !== null
      ? (result as Record<string, unknown>)
      : objectText;
  } catch {
    return objectText;
  }
};

const splitObjectProperties = (propsStr: string): string[] => {
  const properties: string[] = [];
  let current = '';
  let braceDepth = 0;

  for (const char of propsStr) {
    if (char === '{') {
      braceDepth += 1;
      current += char;
    } else if (char === '}') {
      braceDepth -= 1;
      current += char;
    } else if (char === ';' && braceDepth === 0) {
      if (current.trim()) {
        properties.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    properties.push(current.trim());
  }

  return properties;
};

const splitUnionTypes = (typeStr: string): string[] => {
  const types: string[] = [];
  let current = '';
  let braceDepth = 0;
  let angleDepth = 0;
  let parenDepth = 0;

  for (let i = 0; i < typeStr.length; i += 1) {
    const char = typeStr[i];

    if (char === '{') {
      braceDepth += 1;
      current += char;
    } else if (char === '}') {
      braceDepth -= 1;
      current += char;
    } else if (char === '<') {
      angleDepth += 1;
      current += char;
    } else if (char === '>') {
      angleDepth -= 1;
      current += char;
    } else if (char === '(') {
      parenDepth += 1;
      current += char;
    } else if (char === ')') {
      parenDepth -= 1;
      current += char;
    } else if (char === '|' && braceDepth === 0 && angleDepth === 0 && parenDepth === 0) {
      if (current.trim()) {
        types.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    types.push(current.trim());
  }

  return types;
};

const parseTypeString = (typeStr: string): ParsedType | string => {
  if (!typeStr || typeStr === 'unknown' || typeStr === 'any') {
    return { base: typeStr, kind: 'primitive' };
  }

  const topLevelUnionTypes = splitUnionTypes(typeStr);
  if (topLevelUnionTypes.length > 1) {
    const types = topLevelUnionTypes.map((t) => parseTypeString(t));
    const filteredTypes = types.filter((parsedType) => {
      if (typeof parsedType === 'string') {
        return parsedType !== 'undefined';
      }
      return !(parsedType.kind === 'primitive' && parsedType.base === 'undefined');
    });

    if (filteredTypes.length === 0) {
      return { base: 'undefined', kind: 'primitive' };
    }

    if (filteredTypes.length === 1) {
      return filteredTypes[0];
    }

    return { kind: 'union', types: filteredTypes };
  }

  if (typeStr.endsWith('[]')) {
    const itemType = typeStr.slice(0, -2);
    return {
      itemType: parseTypeString(itemType),
      kind: 'array',
    };
  }

  if (typeStr.startsWith('Array<') && typeStr.endsWith('>')) {
    const itemType = typeStr.slice(6, -1);
    return {
      itemType: parseTypeString(itemType),
      kind: 'array',
    };
  }

  if (['string', 'number', 'boolean', 'null', 'undefined', 'void'].includes(typeStr)) {
    return { base: typeStr, kind: 'primitive' };
  }

  if ((typeStr.startsWith('{') && typeStr.endsWith('}')) || typeStr === '{}') {
    if (typeStr === '{}') {
      return { kind: 'object', properties: {} };
    }

    const propsStr = typeStr.slice(1, -1).trim();
    if (!propsStr) {
      return { kind: 'object', properties: {} };
    }

    const properties: Record<string, ParsedType | string> = {};
    const propLines = splitObjectProperties(propsStr);

    for (const propLine of propLines) {
      const colonIndex = propLine.indexOf(':');
      if (colonIndex === -1) {
        continue;
      }

      let propName = propLine.slice(0, colonIndex).trim();
      const propType = propLine.slice(colonIndex + 1).trim();

      const isOptional = propName.endsWith('?');
      if (isOptional) {
        propName = propName.slice(0, -1).trim();
      }

      const parsedPropType = parseTypeString(propType);
      if (typeof parsedPropType === 'object') {
        parsedPropType.required = !isOptional;
      }

      properties[propName] = parsedPropType;
    }

    return {
      kind: 'object',
      properties,
    };
  }

  return { base: typeStr, kind: 'primitive' };
};

const extractDefaultValue = (
  initializer: Node | undefined,
): boolean | number | string | undefined | unknown[] | Record<string, unknown> => {
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
    return parseObjectLiteral(initializer.getText());
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

const inferReturnTypeFromAst = (methodDecl: MethodDeclaration): SerializedType | undefined => {
  const body = methodDecl.getBody();

  if (!body) {
    return undefined;
  }

  const returnStatements = body.getDescendantsOfKind(SyntaxKind.ReturnStatement);

  for (const returnStatement of returnStatements) {
    const expression = returnStatement.getExpression();

    if (!expression) {
      continue;
    }

    if (Node.isCallExpression(expression)) {
      const expressionText = expression.getExpression().getText();
      const firstArg = expression.getArguments()[0];

      if (expressionText === 'Promise.resolve' && firstArg) {
        return serializeExpression(firstArg);
      }
    }

    return serializeExpression(expression);
  }

  return undefined;
};

const createOutputMetadata = (serializedType: SerializedType): ParameterMetadata => ({
  name: 'output',
  required: true,
  type: serializedType,
});

function extractReturnTypeMetadata(methodDecl: any): ParameterMetadata | undefined {
  const signature = methodDecl.getType().getCallSignatures()[0];

  if (!signature) {
    return undefined;
  }

  let returnType = signature.getReturnType();

  if (
    returnType.getSymbol()?.getName() === 'Promise' ||
    returnType.getText().startsWith('Promise<')
  ) {
    const typeArgs = returnType.getTypeArguments();
    if (typeArgs.length > 0) {
      returnType = typeArgs[0];
    }
  }

  const astReturnType = inferReturnTypeFromAst(methodDecl);

  const shouldUseAstReturnType =
    Boolean(astReturnType) &&
    (returnType.isVoid() ||
      returnType.isNever() ||
      returnType.isUndefined() ||
      returnType.isAny() ||
      returnType.isUnknown() ||
      astReturnType.kind === 'object' ||
      astReturnType.kind === 'array' ||
      astReturnType.kind === 'union');

  if (shouldUseAstReturnType) {
    return createOutputMetadata(astReturnType);
  }

  if (
    returnType.isVoid() ||
    returnType.isNever() ||
    returnType.isUndefined() ||
    returnType.isAny() ||
    returnType.isUnknown()
  ) {
    return createOutputMetadata({
      kind: 'object',
      properties: {
        error: {
          base: 'string',
          kind: 'primitive',
          required: true,
        },
        message: { base: 'string', kind: 'primitive', required: true },
        name: { base: 'string', kind: 'primitive', required: true },
        stack: { base: 'string', kind: 'primitive', required: true },
        statusCode: { base: 'number', kind: 'primitive', required: true },
      },
    });
  }

  const serialized = serializeType(returnType);

  return createOutputMetadata(serialized);
}

const fallbackToAstOnly = (methodDecl: MethodDeclaration): ParameterMetadata[] =>
  methodDecl.getParameters().map((param, index) => {
    let name = param.getName();
    if (name.trim().startsWith('{') && name.trim().endsWith('}')) {
      name = index === 0 ? 'payload' : `payload${index + 1}`;
    }
    const typeText = param.getTypeNode()?.getText() ?? param.getType().getText();
    return {
      defaultValue: extractDefaultValue(param.getInitializer()),
      description: extractJsDocDescription(methodDecl, name),
      name,
      required: !param.isOptional(),
      type: parseTypeString(typeText),
    };
  });

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
      let paramName = invokerParam.name;
      if (paramName.trim().startsWith('{') && paramName.trim().endsWith('}')) {
        paramName = i === 0 ? 'payload' : `payload${i + 1}`;
      }

      if (i >= astParams.length) {
        return {
          name: paramName,
          required: true,
          type: 'unknown',
        };
      }

      const typeText = astParam.getTypeNode()?.getText() ?? astParam.getType().getText();
      return {
        defaultValue: extractDefaultValue(astParam.getInitializer()),
        description: extractJsDocDescription(methodDecl, paramName),
        name: paramName,
        required: !astParam.isOptional(),
        type: parseTypeString(typeText),
      };
    });

    return mergedParams;
  } catch {
    return fallbackToAstOnly(methodDecl);
  }
};

export {
  extractDefaultValue,
  extractJsDocDescription,
  extractParameterMetadata,
  extractReturnTypeDescription,
  extractReturnTypeMetadata,
  fallbackToAstOnly,
  isServiceConstructor,
  parseTypeString,
};
