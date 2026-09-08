import ts from 'typescript';

import { baseStyles, intentInput, intentSoft, intentSolid } from '../tokens/base';

type ASTNode =
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'array'; value: ASTNode[] }
  | { kind: 'object'; value: Record<string, ASTNode> }
  | { kind: 'template'; raw: string }
  | { kind: 'call'; name: string; args: ASTNode[] }
  | { kind: 'ref'; name: string }
  | { kind: 'unknown'; raw: string };

type Ctx = Record<string, unknown>;

const warn = (message: string, meta?: unknown) => {
  globalThis.console.warn(`[style-compiler] ${message}`, meta);
};

const isObject = (val: unknown): val is Record<string, unknown> =>
  typeof val === 'object' && val !== null;

const isFunction = (val: unknown): val is (...args: unknown[]) => unknown =>
  typeof val === 'function';

const unwrap = (node: ts.Expression): ts.Expression => {
  let current = node;

  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }

  return current;
};

const getKey = (name: ts.PropertyName): string => {
  if (ts.isIdentifier(name)) {
    return name.text;
  }
  if (ts.isStringLiteral(name)) {
    return name.text;
  }
  if (ts.isNumericLiteral(name)) {
    return name.text;
  }
  return name.getText();
};

const stripTemplate = (raw: string) =>
  raw.startsWith('`') && raw.endsWith('`') ? raw.slice(1, -1) : raw;

const resolvePath = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, key) => {
    if (isObject(acc)) {
      return acc[key];
    }
    return undefined;
  }, obj);

const parseValue = (inputNode: ts.Expression): ASTNode => {
  const node = unwrap(inputNode);

  if (ts.isPropertyAccessExpression(node)) {
    return {
      kind: 'ref',
      name: node.getText(),
    };
  }

  if (ts.isStringLiteral(node)) {
    return { kind: 'string', value: node.text };
  }

  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return { kind: 'string', value: node.text };
  }

  if (ts.isNumericLiteral(node)) {
    return { kind: 'number', value: Number(node.text) };
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return { kind: 'boolean', value: true };
  }

  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return { kind: 'boolean', value: false };
  }

  if (ts.isArrayLiteralExpression(node)) {
    return {
      kind: 'array',
      value: node.elements.map((e) => parseValue(e)),
    };
  }

  if (ts.isObjectLiteralExpression(node)) {
    const obj: Record<string, ASTNode> = {};

    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) {
        continue;
      }

      obj[getKey(prop.name)] = parseValue(prop.initializer);
    }

    return { kind: 'object', value: obj };
  }

  if (ts.isTemplateExpression(node)) {
    return {
      kind: 'template',
      raw: stripTemplate(node.getText()),
    };
  }

  if (ts.isCallExpression(node)) {
    return {
      args: node.arguments.map((a) => parseValue(a)),
      kind: 'call',
      name: node.expression.getText(),
    };
  }

  if (ts.isIdentifier(node)) {
    return { kind: 'ref', name: node.text };
  }

  return { kind: 'unknown', raw: node.getText() };
};

const resolveValue = (node: ASTNode, ctx: Ctx): unknown => {
  switch (node.kind) {
    case 'string':
    case 'number':
    case 'boolean': {
      return node.value;
    }

    case 'array': {
      return node.value.map((v) => resolveValue(v, ctx));
    }

    case 'object': {
      const out: Record<string, unknown> = {};

      for (const key of Object.keys(node.value)) {
        out[key] = resolveValue(node.value[key], ctx);
      }

      return out;
    }

    case 'template': {
      return node.raw.replaceAll(/\$\{(?<expr>[^}]+)\}/gu, (_, expr: string) => {
        const path = expr.trim();
        const value = resolvePath(ctx, path);

        if (value === null || value === undefined) {
          warn(`Unresolved template variable: "${path}"`, { node });
          return '';
        }
        if (typeof value === 'string') {
          return value;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
          return String(value);
        }

        return JSON.stringify(value);
      });
    }

    case 'call': {
      const fn = resolvePath(ctx, node.name);

      if (fn === undefined) {
        warn(`Missing function in ctx: "${node.name}"`, { node });
        return undefined;
      }

      if (!isFunction(fn)) {
        warn(`"${node.name}" is not a function`, { node, value: fn });
        return undefined;
      }

      return fn(...node.args.map((a) => resolveValue(a, ctx)));
    }

    case 'ref': {
      const value = resolvePath(ctx, node.name);

      if (value === undefined) {
        warn(`Unresolved reference: "${node.name}"`, { node });
      }

      return value;
    }

    case 'unknown': {
      warn(`Unknown AST node, cannot resolve`, node.raw);
      return undefined;
    }

    default: {
      warn(`Unhandled AST node kind`, node);
      return undefined;
    }
  }
};

const extractStylesFromFile = (file: string): Record<string, ASTNode> => {
  const source = ts.sys.readFile(file) ?? '';

  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const result: Record<string, ASTNode> = {};

  ts.forEachChild(sf, (n) => {
    if (!ts.isVariableStatement(n)) {
      return;
    }

    for (const decl of n.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name)) {
        continue;
      }
      if (!decl.name.text.endsWith('Styles')) {
        continue;
      }
      if (!decl.initializer) {
        continue;
      }

      result[decl.name.text] = parseValue(decl.initializer);
    }
  });

  return result;
};

const getRootName = (name: string): string => name.split('.')[0];

const collectRefNames = (node: ASTNode, acc: Set<string>): void => {
  switch (node.kind) {
    case 'array': {
      for (const v of node.value) {
        collectRefNames(v, acc);
      }
      break;
    }
    case 'object': {
      for (const key of Object.keys(node.value)) {
        collectRefNames(node.value[key], acc);
      }
      break;
    }
    case 'call': {
      acc.add(getRootName(node.name));
      for (const arg of node.args) {
        collectRefNames(arg, acc);
      }
      break;
    }
    case 'ref': {
      acc.add(getRootName(node.name));
      break;
    }
    case 'template': {
      for (const match of node.raw.matchAll(/\$\{(?<expr>[^}]+)\}/gu)) {
        const expr = match.groups?.['expr']?.trim();
        if (expr !== undefined && expr !== '') {
          acc.add(getRootName(expr));
        }
      }
      break;
    }
    case 'string':
    case 'number':
    case 'boolean':
    case 'unknown': {
      break;
    }
    default: {
      break;
    }
  }
};

const sortRegistryKeys = (registry: Record<string, ASTNode>): string[] => {
  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (key: string): void => {
    if (visited.has(key) || visiting.has(key)) {
      return;
    }
    visiting.add(key);

    const node = registry[key];
    const deps = new Set<string>();
    collectRefNames(node, deps);

    for (const dep of deps) {
      if (dep !== key && dep in registry) {
        visit(dep);
      }
    }

    visiting.delete(key);
    visited.add(key);
    order.push(key);
  };

  for (const key of Object.keys(registry)) {
    visit(key);
  }

  return order;
};

const compileStylesRegistry = (registry: Record<string, ASTNode>) => {
  const ctx: Ctx = {
    baseStyles,
    intentInput,
    intentSoft,
    intentSolid,
  };

  const resolved: Record<string, unknown> = {};

  for (const key of sortRegistryKeys(registry)) {
    const value = resolveValue(registry[key], ctx);
    resolved[key] = value;
    ctx[key] = value;
  }

  return resolved;
};

export {
  collectRefNames,
  compileStylesRegistry,
  extractStylesFromFile,
  getKey,
  getRootName,
  parseValue,
  resolvePath,
  resolveValue,
  sortRegistryKeys,
  stripTemplate,
  unwrap,
};
export type { ASTNode, Ctx };
