import {
  type Identifier,
  type MethodDeclaration,
  Node,
  type ObjectLiteralExpression,
  SyntaxKind,
  type Type,
} from 'ts-morph';
import type { ParameterMetadata } from '../types/parameter';

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

  return (
    (left.types ?? []).length === (right.types ?? []).length &&
    (left.types ?? []).every((type, index) =>
      areSerializedTypesEqual(type, right.types?.[index] ?? { base: 'unknown', kind: 'primitive' }),
    )
  );
};

const serializeFwd: {
  expression: (node: Node) => SerializedType;
  fromType: (type: Type, node: Node) => SerializedType;
  node: (node: Node) => SerializedType;
  type: (type: Type, node?: Node) => SerializedType;
} = {
  expression: (_node: Node): SerializedType => {
    throw new Error('serializeExpression not yet initialized');
  },
  fromType: (_type: Type, _node: Node): SerializedType => {
    throw new Error('serializeFromType not yet initialized');
  },
  node: (_node: Node): SerializedType => {
    throw new Error('serializeNode not yet initialized');
  },
  type: (_type: Type, _node?: Node): SerializedType => {
    throw new Error('serializeType not yet initialized');
  },
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

const resolveCustomTypeName = (name: string, node?: Node): SerializedType | undefined => {
  if (!node) {
    return undefined;
  }

  try {
    const sourceFile = node.getSourceFile();

    const intf = sourceFile.getInterface(name);

    if (intf) {
      const properties: Record<string, SerializedType> = {};

      for (const prop of intf.getProperties()) {
        const propType = prop.getType();
        const serialized = serializeFwd.fromType(propType, prop);
        serialized.required = !prop.hasQuestionToken();
        properties[prop.getName()] = serialized;
      }

      return {
        kind: 'object',
        properties,
      };
    }

    const typeAlias = sourceFile.getTypeAlias(name);

    if (typeAlias) {
      const type = typeAlias.getType();
      return serializeFwd.fromType(type, typeAlias);
    }

    for (const importDecl of sourceFile.getImportDeclarations()) {
      const namedImports = importDecl.getNamedImports();
      const found = namedImports.find((spec) => spec.getName() === name);
      if (found) {
        const resolvedSourceFile = importDecl.getModuleSpecifierSourceFile();

        if (resolvedSourceFile) {
          const resolvedIntf = resolvedSourceFile.getInterface(name);

          if (resolvedIntf) {
            const properties: Record<string, SerializedType> = {};
            for (const prop of resolvedIntf.getProperties()) {
              const propType = prop.getType();
              const serialized = serializeFwd.fromType(propType, prop);
              serialized.required = !prop.hasQuestionToken();
              properties[prop.getName()] = serialized;
            }
            return {
              kind: 'object',
              properties,
            };
          }

          const resolvedTypeAlias = resolvedSourceFile.getTypeAlias(name);

          if (resolvedTypeAlias) {
            return serializeFwd.fromType(resolvedTypeAlias.getType(), resolvedTypeAlias);
          }
        }
      }
    }
  } catch {
    // Avoid crashing if there's any AST traversal issue
  }
  return undefined;
};

const parsedTypeToSerializedType = (parsed: ParsedType, node?: Node): SerializedType => {
  const convertItem = (item: ParsedType | string | undefined): SerializedType | undefined => {
    if (item === undefined) {
      return undefined;
    }

    if (typeof item === 'string') {
      const builtInPrimitives = [
        'string',
        'number',
        'boolean',
        'null',
        'undefined',
        'any',
        'unknown',
        'void',
      ];

      if (!builtInPrimitives.includes(item)) {
        const custom = resolveCustomTypeName(item, node);

        if (custom) {
          return custom;
        }
      }

      return { base: item, kind: 'primitive' };
    }

    return parsedTypeToSerializedType(item, node);
  };

  const properties: Record<string, SerializedType> | undefined =
    parsed.properties === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(parsed.properties).map(([k, v]) => [
            k,
            convertItem(v) ?? { kind: 'primitive' },
          ]),
        );

  const types: SerializedType[] | undefined =
    parsed.types === undefined
      ? undefined
      : parsed.types.map((t) => convertItem(t) ?? { kind: 'primitive' });

  const itemType = convertItem(parsed.itemType);

  const extras: Partial<SerializedType> = {};

  if (parsed.base !== undefined) {
    const builtInPrimitives = [
      'string',
      'number',
      'boolean',
      'null',
      'undefined',
      'any',
      'unknown',
      'void',
    ];

    if (!builtInPrimitives.includes(parsed.base)) {
      const custom = resolveCustomTypeName(parsed.base, node);
      if (custom) {
        return custom;
      }
    }

    extras.base = parsed.base;
  }

  if (itemType !== undefined) {
    extras.itemType = itemType;
  }

  const result: SerializedType = Object.assign(extras, { kind: parsed.kind });

  if (properties !== undefined) {
    result.properties = properties;
  }

  if (parsed.required !== undefined) {
    result.required = parsed.required;
  }

  if (types !== undefined) {
    result.types = types;
  }

  return result;
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

  for (const char of typeStr) {
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

const serializeTypeArray = (
  type: Type,
  text: string,
  enclosingNode?: Node,
): SerializedType | undefined => {
  const element = type.getArrayElementType();
  if (element) {
    return {
      itemType: serializeFwd.type(element, enclosingNode),
      kind: 'array',
    };
  }

  if (type.isArray()) {
    const [t] = type.getTypeArguments();
    return {
      itemType: serializeFwd.type(t, enclosingNode),
      kind: 'array',
    };
  }

  if (text.startsWith('Array<') && text.endsWith('>')) {
    const [t] = type.getTypeArguments();
    return {
      itemType: serializeFwd.type(t, enclosingNode),
      kind: 'array',
    };
  }

  if (text.endsWith('[]')) {
    const parsed = parseTypeString(text);
    if (typeof parsed === 'string') {
      return { base: parsed, kind: 'primitive' };
    }

    const normalized =
      typeof parsed === 'string' ? { base: parsed, kind: 'primitive' as const } : parsed;

    return parsedTypeToSerializedType(normalized, enclosingNode);
  }

  return undefined;
};

const serializeTypeObject = (
  type: Type,
  text: string,
  enclosingNode?: Node,
): SerializedType | undefined => {
  if (type.isObject() && !type.isArray()) {
    const props: Record<string, SerializedType> = {};

    for (const symbol of type.getProperties()) {
      const declarations = symbol.getDeclarations();
      const firstDecl = declarations.length > 0 ? declarations[0] : undefined;
      const propEnclosingNode = firstDecl ?? enclosingNode;

      let propType = propEnclosingNode
        ? propEnclosingNode
            .getSourceFile()
            .getProject()
            .getTypeChecker()
            .getTypeOfSymbolAtLocation(symbol, propEnclosingNode)
        : undefined;

      if (firstDecl) {
        propType = firstDecl.getType();
      }

      if (propType === undefined) {
        continue;
      }

      const serialized = serializeFwd.type(propType, propEnclosingNode);
      serialized.required = !symbol.isOptional();
      props[symbol.getName()] = serialized;
    }

    if (
      Object.keys(props).length === 0 &&
      text &&
      !text.startsWith('{') &&
      !text.startsWith('typeof ') &&
      !text.includes('=>')
    ) {
      const customResolved = resolveCustomTypeName(text, enclosingNode);
      if (customResolved) {
        return customResolved;
      }
    }

    return {
      kind: 'object',
      properties: props,
    };
  }

  return undefined;
};

const serializeType = (type: Type, node?: Node): SerializedType => {
  const text = type.getText();
  const enclosingNode = node;

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

  const arrayResult = serializeTypeArray(type, text, enclosingNode);
  if (arrayResult !== undefined) {
    return arrayResult;
  }

  if (type.isUnion()) {
    return {
      kind: 'union',
      types: type
        .getUnionTypes()
        .filter((t) => !isUndefinedLikeType(t))
        .map((t) => serializeType(t, enclosingNode)),
    };
  }

  const objectResult = serializeTypeObject(type, text, enclosingNode);
  if (objectResult !== undefined) {
    return objectResult;
  }

  if (enclosingNode) {
    const customResolved = resolveCustomTypeName(text, enclosingNode);
    if (customResolved) {
      return customResolved;
    }
  }

  return {
    base: text,
    kind: 'primitive',
  };
};

const getParamOrVarTypeName = (node: Identifier): string | undefined => {
  const defs = node.getDefinitionNodes();
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
  const defs = node.getDefinitionNodes();

  for (const def of defs) {
    if (Node.isParameterDeclaration(def)) {
      return def.getType();
    }

    if (Node.isVariableDeclaration(def)) {
      return def.getType();
    }
  }

  return node.getType();
};

const serializeNode = (node: Node): SerializedType => serializeFwd.node(node);
const serializeExpression = (node: Node): SerializedType => serializeFwd.expression(node);

const serializeObject = (node: ObjectLiteralExpression): SerializedType => {
  const properties: Record<string, SerializedType> = {};

  for (const prop of node.getProperties()) {
    if (Node.isPropertyAssignment(prop)) {
      const name = prop.getName();
      const init = prop.getInitializer();

      if (!init) {
        continue;
      }

      properties[name] = serializeNode(init);
    }

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

const serializeFromTypePrimitive = (type: Type): SerializedType | undefined => {
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

  return undefined;
};

const serializeFromTypeArray = (
  type: Type,
  text: string,
  node: Node,
): SerializedType | undefined => {
  const elementType = type.getArrayElementType();
  if (elementType) {
    return {
      itemType: serializeFwd.fromType(elementType, node),
      kind: 'array',
    };
  }

  if (type.isArray()) {
    const [t] = type.getTypeArguments();
    return {
      itemType: serializeFwd.fromType(t, node),
      kind: 'array',
    };
  }

  if (text.startsWith('Array<') && text.endsWith('>')) {
    const [t] = type.getTypeArguments();
    return {
      itemType: serializeFwd.fromType(t, node),
      kind: 'array',
    };
  }

  if (text.endsWith('[]')) {
    const parsed = parseTypeString(text);
    if (typeof parsed === 'string') {
      return { base: parsed, kind: 'primitive' };
    }

    const normalized =
      typeof parsed === 'string' ? { base: parsed, kind: 'primitive' as const } : parsed;
    return parsedTypeToSerializedType(normalized, node);
  }

  return undefined;
};

const serializeFromType = (type: Type, node: Node): SerializedType => {
  const text = type.getText(node);

  const primitiveResult = serializeFromTypePrimitive(type);
  if (primitiveResult !== undefined) {
    return primitiveResult;
  }

  const arrayResult = serializeFromTypeArray(type, text, node);
  if (arrayResult !== undefined) {
    return arrayResult;
  }

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

  if (type.isObject() && !type.isArray()) {
    const props: Record<string, SerializedType> = {};

    for (const symbol of type.getProperties()) {
      const declarations = symbol.getDeclarations();
      const firstDecl = declarations.length > 0 ? declarations[0] : undefined;
      const enclosingNode = firstDecl ?? node;

      let propType = enclosingNode
        .getSourceFile()
        .getProject()
        .getTypeChecker()
        .getTypeOfSymbolAtLocation(symbol, enclosingNode);

      if (firstDecl) {
        propType = firstDecl.getType();
      }

      const serialized = serializeFromType(propType, enclosingNode);
      serialized.required = !symbol.isOptional();
      props[symbol.getName()] = serialized;
    }

    if (
      Object.keys(props).length === 0 &&
      text &&
      !text.startsWith('{') &&
      !text.startsWith('typeof ') &&
      !text.includes('=>')
    ) {
      const customResolved = resolveCustomTypeName(text, node);
      if (customResolved) {
        return customResolved;
      }
    }

    return {
      kind: 'object',
      properties: props,
    };
  }

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

const serializeNodeImpl = (node: Node): SerializedType => {
  if (Node.isArrayLiteralExpression(node)) {
    return serializeArrayLiteral(node);
  }

  if (Node.isObjectLiteralExpression(node)) {
    return serializeObject(node);
  }

  if (Node.isIdentifier(node)) {
    const typeName = getParamOrVarTypeName(node);
    if (typeName !== undefined && typeName !== '') {
      const parsed = parseTypeString(typeName);

      if (typeof parsed === 'object' && parsed.kind === 'array') {
        return parsedTypeToSerializedType(parsed);
      }
    }

    return serializeFromType(resolveIdentifierType(node), node);
  }

  const type = node.getType();

  return serializeFromType(type, node);
};

serializeFwd.node = serializeNodeImpl;

const serializeObjectLiteral = (node: ObjectLiteralExpression): SerializedType => {
  const properties: Record<string, SerializedType> = {};

  for (const prop of node.getProperties()) {
    if (Node.isPropertyAssignment(prop)) {
      const name = prop.getName();
      const init = prop.getInitializer();

      if (!init) {
        continue;
      }

      properties[name] = serializeExpression(init);
    }

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

const serializeExpressionFromLiterals = (node: Node): SerializedType | undefined => {
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

  return undefined;
};

const serializeExpressionFromType = (node: Node): SerializedType => {
  const type = node.getType();
  const text = type.getText(node);

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

  const arr = type.getArrayElementType();

  if (arr) {
    return { itemType: serializeFromType(arr, node), kind: 'array' };
  }

  if (text.endsWith('[]') || text.startsWith('Array<') || text.startsWith('ReadonlyArray<')) {
    const [inner] = type.getTypeArguments();
    return {
      itemType: serializeFromType(inner, node),
      kind: 'array',
    };
  }

  if (type.getProperties().length > 0 && !type.isArray()) {
    return serializeFromType(type, node);
  }

  if (type.isUnion()) {
    const filtered = type.getUnionTypes().filter((t) => !isUndefinedLikeType(t));
    if (filtered.length === 1) {
      return serializeFromType(filtered[0], node);
    }

    return { kind: 'union', types: filtered.map((t) => serializeFromType(t, node)) };
  }

  return { base: text, kind: 'primitive' };
};

const hasResolvedProperties = (type: SerializedType): boolean => {
  if (type.kind === 'object') {
    return type.properties !== undefined && Object.keys(type.properties).length > 0;
  }

  if (type.kind === 'array') {
    return type.itemType !== undefined && hasResolvedProperties(type.itemType);
  }

  if (type.kind === 'union') {
    return type.types?.some(hasResolvedProperties) ?? false;
  }

  return false;
};

const serializeExpressionImpl = (node: Node): SerializedType => {
  if (Node.isArrayLiteralExpression(node)) {
    return serializeArrayLiteral(node);
  }

  if (Node.isObjectLiteralExpression(node)) {
    return serializeObjectLiteral(node);
  }

  if (Node.isIdentifier(node)) {
    const typeName = getParamOrVarTypeName(node);
    const resolvedType = resolveIdentifierType(node);

    if (typeName !== undefined && typeName !== '') {
      const parsed = parseTypeString(typeName);
      const normalized =
        typeof parsed === 'string' ? { base: parsed, kind: 'primitive' as const } : parsed;
      const serialized = parsedTypeToSerializedType(normalized, node);

      if (hasResolvedProperties(serialized)) {
        return serialized;
      }

      if (typeof parsed === 'object' && parsed.kind === 'array') {
        let baseType: string | undefined = undefined;

        if (typeof parsed.itemType === 'string') {
          baseType = parsed.itemType;
        } else if (
          parsed.itemType &&
          typeof parsed.itemType === 'object' &&
          'kind' in parsed.itemType &&
          parsed.itemType.kind === 'primitive'
        ) {
          baseType = parsed.itemType.base;
        }

        const builtInPrimitives = [
          'string',
          'number',
          'boolean',
          'null',
          'undefined',
          'any',
          'unknown',
          'void',
        ];

        if (baseType !== undefined && builtInPrimitives.includes(baseType)) {
          return parsedTypeToSerializedType(parsed, node);
        }
      }
    }

    return serializeFromType(resolvedType, node);
  }

  const literalResult = serializeExpressionFromLiterals(node);

  if (literalResult !== undefined) {
    return literalResult;
  }

  return serializeExpressionFromType(node);
};

serializeFwd.expression = serializeExpressionImpl;
serializeFwd.fromType = serializeFromType;
serializeFwd.node = serializeNodeImpl;
serializeFwd.type = serializeType;

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
        const match = /@param\s+(?:\{[^}]+\}\s+)?(?<paramName>\w+)\s+(?<paramDesc>.+)/u.exec(
          tagText,
        );

        if (match?.groups?.['paramName'] === paramName) {
          return match.groups['paramDesc']?.trim();
        }
      }
    }
  }

  return undefined;
};

const extractDefaultValue = (
  initializer: Node | undefined,
): boolean | number | string | undefined | unknown[] | Record<string, unknown> => {
  if (!initializer) {
    return undefined;
  }

  const kind = initializer.getKind();

  if (kind === SyntaxKind.ArrayLiteralExpression && Node.isArrayLiteralExpression(initializer)) {
    return initializer.getElements().map((el) => extractDefaultValue(el));
  }

  if (kind === SyntaxKind.ObjectLiteralExpression && Node.isObjectLiteralExpression(initializer)) {
    const result: Record<string, unknown> = {};
    for (const prop of initializer.getProperties()) {
      if (Node.isPropertyAssignment(prop)) {
        const name = prop.getName();
        const init = prop.getInitializer();
        if (init) {
          result[name] = extractDefaultValue(init);
        }
      } else if (Node.isShorthandPropertyAssignment(prop)) {
        const name = prop.getName();
        result[name] = undefined;
      }
    }
    return result;
  }

  if (kind === SyntaxKind.FalseKeyword) {
    return false;
  }

  if (kind === SyntaxKind.NumericLiteral) {
    return Number(initializer.getText());
  }

  if (kind === SyntaxKind.StringLiteral && Node.isStringLiteral(initializer)) {
    return initializer.getLiteralValue();
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
        const match = /@returns?\s+(?:\{[^}]+\}\s+)?(?<desc>.+)/u.exec(tagText);
        const matchValue = match?.groups?.['desc'];
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
      const [firstArg] = expression.getArguments();

      if (expressionText === 'Promise.resolve') {
        return serializeExpression(firstArg);
      }
    }

    return serializeExpression(expression);
  }

  return undefined;
};

const createOutputMetadata = (
  serializedType: SerializedType,
  description?: string,
): ParameterMetadata => ({
  description,
  name: 'output',
  required: true,
  type: serializedType,
});

const extractReturnTypeMetadata = (
  methodDecl: MethodDeclaration,
): ParameterMetadata | undefined => {
  const callSignatures = methodDecl.getType().getCallSignatures();

  if (callSignatures.length === 0) {
    return undefined;
  }

  const description = extractReturnTypeDescription(methodDecl);
  let returnType = callSignatures[0].getReturnType();

  if (
    returnType.getSymbol()?.getName() === 'Promise' ||
    returnType.getText().startsWith('Promise<')
  ) {
    const typeArgs = returnType.getTypeArguments();

    if (typeArgs.length > 0) {
      const [firstTypeArg] = typeArgs;
      returnType = firstTypeArg;
    }
  }

  const astReturnType = inferReturnTypeFromAst(methodDecl);

  const shouldUseAstReturnType =
    astReturnType !== undefined &&
    (returnType.isVoid() ||
      returnType.isNever() ||
      returnType.isUndefined() ||
      returnType.isAny() ||
      returnType.isUnknown() ||
      astReturnType.kind === 'object' ||
      astReturnType.kind === 'array' ||
      astReturnType.kind === 'union');

  if (shouldUseAstReturnType) {
    return createOutputMetadata(astReturnType, description);
  }

  if (
    returnType.isVoid() ||
    returnType.isNever() ||
    returnType.isUndefined() ||
    returnType.isAny() ||
    returnType.isUnknown()
  ) {
    return createOutputMetadata(
      {
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
      },
      description,
    );
  }

  const serialized = serializeType(returnType, methodDecl);

  return createOutputMetadata(serialized, description);
};

const fallbackToAstOnly = (methodDecl: MethodDeclaration): ParameterMetadata[] =>
  methodDecl.getParameters().map((param, index) => {
    let name = param.getName();

    if (name.trim().startsWith('{') && name.trim().endsWith('}')) {
      name = index === 0 ? 'payload' : `payload${index + 1}`;
    }

    const typeText = param.getTypeNode()?.getText() ?? param.getType().getText();
    const parsed = parseTypeString(typeText);
    const normalized =
      typeof parsed === 'string' ? { base: parsed, kind: 'primitive' as const } : parsed;

    return {
      defaultValue: extractDefaultValue(param.getInitializer()),
      description: extractJsDocDescription(methodDecl, name),
      name,
      required: !param.isOptional(),
      type: parsedTypeToSerializedType(normalized, param),
    };
  });

const extractParameterMetadata = (
  methodDecl: MethodDeclaration,
  _serviceFilePath: string,
  _serviceClassName: string,
  _methodName: string,
): ParameterMetadata[] => fallbackToAstOnly(methodDecl);

export type { ParsedType, SerializedType };
export {
  areSerializedTypesEqual,
  serializeFwd,
  isUndefinedLikeType,
  mergeSerializedTypes,
  resolveCustomTypeName,
  parsedTypeToSerializedType,
  splitObjectProperties,
  splitUnionTypes,
  serializeTypeArray,
  serializeTypeObject,
  serializeType,
  getParamOrVarTypeName,
  resolveIdentifierType,
  serializeNode,
  serializeExpression,
  serializeObject,
  serializeFromTypePrimitive,
  serializeFromTypeArray,
  serializeFromType,
  serializeArrayLiteral,
  serializeNodeImpl,
  serializeObjectLiteral,
  serializeExpressionFromLiterals,
  serializeExpressionFromType,
  hasResolvedProperties,
  serializeExpressionImpl,
  extractDefaultValue,
  extractJsDocDescription,
  extractParameterMetadata,
  extractReturnTypeDescription,
  inferReturnTypeFromAst,
  createOutputMetadata,
  extractReturnTypeMetadata,
  fallbackToAstOnly,
  parseTypeString,
};
