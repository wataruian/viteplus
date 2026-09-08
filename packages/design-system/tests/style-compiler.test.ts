import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import ts from 'typescript';
import { describe, expect, test, vi } from 'vite-plus/test';

import { intentSolid } from '../src/tokens/base';
import {
  type ASTNode,
  collectRefNames,
  compileStylesRegistry,
  extractStylesFromFile,
  getRootName,
  parseValue,
  resolvePath,
  resolveValue,
  sortRegistryKeys,
  stripTemplate,
  unwrap,
} from '../src/utils/style-compiler';

const DOLLAR = '$';
const templateVar = (expr: string): string => `${DOLLAR}{${expr}}`;

const makeMalformedNode = (): ASTNode => {
  const node: ASTNode = { kind: 'string', value: 'x' };
  const mutableView: Record<string, unknown> = node;
  mutableView['kind'] = 'bogus';
  return node;
};

const parseExpr = (source: string): ts.Expression => {
  const sf = ts.createSourceFile(
    'inline.tsx',
    `const __value = ${source};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const [statement] = sf.statements;
  if (!ts.isVariableStatement(statement)) {
    throw new Error('expected a variable statement');
  }
  const [decl] = statement.declarationList.declarations;
  if (!decl.initializer) {
    throw new Error('expected an initializer');
  }
  return decl.initializer;
};

const parseExprAsTs = (source: string): ts.Expression => {
  const sf = ts.createSourceFile(
    'inline.ts',
    `const __value = ${source};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const [statement] = sf.statements;
  if (!ts.isVariableStatement(statement)) {
    throw new Error('expected a variable statement');
  }
  const [decl] = statement.declarationList.declarations;
  if (!decl.initializer) {
    throw new Error('expected an initializer');
  }
  return decl.initializer;
};

describe('unwrap', () => {
  test('unwraps parenthesized expressions', () => {
    const result = unwrap(parseExpr('(42)'));
    expect(ts.isNumericLiteral(result) && result.text).toBe('42');
  });

  test('unwraps "as" expressions', () => {
    const result = unwrap(parseExpr('1 as number'));
    expect(ts.isNumericLiteral(result) && result.text).toBe('1');
  });

  test('unwraps nested parenthesized "as" expressions', () => {
    const result = unwrap(parseExpr('((1 as number))'));
    expect(ts.isNumericLiteral(result) && result.text).toBe('1');
  });

  test('unwraps legacy angle-bracket type assertions', () => {
    const result = unwrap(parseExprAsTs('<number>(1)'));
    expect(ts.isNumericLiteral(result) && result.text).toBe('1');
  });

  test('leaves already-bare expressions untouched', () => {
    const expr = parseExpr('"bare"');
    expect(unwrap(expr)).toBe(expr);
  });
});

describe('parseValue', () => {
  test('parses a property-access expression as a dotted ref', () => {
    expect(parseValue(parseExpr('foo.bar'))).toStrictEqual({ kind: 'ref', name: 'foo.bar' });
  });

  test('parses a string literal', () => {
    expect(parseValue(parseExpr("'hello'"))).toStrictEqual({ kind: 'string', value: 'hello' });
  });

  test('parses a no-substitution template literal as a string', () => {
    expect(parseValue(parseExpr('`plain`'))).toStrictEqual({ kind: 'string', value: 'plain' });
  });

  test('parses a numeric literal', () => {
    expect(parseValue(parseExpr('42'))).toStrictEqual({ kind: 'number', value: 42 });
  });

  test('parses true and false as booleans', () => {
    expect(parseValue(parseExpr('true'))).toStrictEqual({ kind: 'boolean', value: true });
    expect(parseValue(parseExpr('false'))).toStrictEqual({ kind: 'boolean', value: false });
  });

  test('parses an array literal element by element', () => {
    expect(parseValue(parseExpr("['a', 1, true]"))).toStrictEqual({
      kind: 'array',
      value: [
        { kind: 'string', value: 'a' },
        { kind: 'number', value: 1 },
        { kind: 'boolean', value: true },
      ],
    });
  });

  test('parses an object literal, keying by identifier, string, and numeric names, and skipping spreads', () => {
    const result = parseValue(parseExpr("{ a: 1, 'b-key': 2, 3: 'three', ...rest }"));
    expect(result).toStrictEqual({
      kind: 'object',
      value: {
        '3': { kind: 'string', value: 'three' },
        a: { kind: 'number', value: 1 },
        'b-key': { kind: 'number', value: 2 },
      },
    });
  });

  test('falls back to getText() for a computed property name', () => {
    const result = parseValue(parseExpr("{ [dynamicKey]: 'val' }"));
    expect(result.kind).toBe('object');
    if (result.kind === 'object') {
      expect(Object.keys(result.value)).toStrictEqual(['[dynamicKey]']);
    }
  });

  test('parses a template expression, stripping the surrounding backticks', () => {
    expect(parseValue(parseExpr(`\`hi ${templateVar('name')}\``))).toStrictEqual({
      kind: 'template',
      raw: `hi ${templateVar('name')}`,
    });
  });

  test('parses a call expression with its callee name and arguments', () => {
    expect(parseValue(parseExpr("foo(1, 'a')"))).toStrictEqual({
      args: [
        { kind: 'number', value: 1 },
        { kind: 'string', value: 'a' },
      ],
      kind: 'call',
      name: 'foo',
    });
  });

  test('parses a bare identifier as a ref', () => {
    expect(parseValue(parseExpr('bareIdent'))).toStrictEqual({ kind: 'ref', name: 'bareIdent' });
  });

  test('falls back to "unknown" for unhandled expression kinds', () => {
    expect(parseValue(parseExpr('cond ? 1 : 2'))).toStrictEqual({
      kind: 'unknown',
      raw: 'cond ? 1 : 2',
    });
  });
});

describe('getKey', () => {
  test('reads identifier, string, and numeric property names directly', () => {
    const obj = parseValue(parseExpr("{ id: 1, 'str': 2, 3: 3 }"));
    expect(obj.kind).toBe('object');
    if (obj.kind === 'object') {
      expect(Object.keys(obj.value)).toStrictEqual(['3', 'id', 'str']);
    }
  });
});

describe('stripTemplate', () => {
  test('removes surrounding backticks', () => {
    expect(stripTemplate('`abc`')).toBe('abc');
  });

  test('returns the input untouched when not backtick-wrapped', () => {
    expect(stripTemplate('abc')).toBe('abc');
  });
});

describe('resolvePath', () => {
  test('walks a dotted path through nested objects', () => {
    expect(resolvePath({ a: { b: 'c' } }, 'a.b')).toBe('c');
  });

  test('returns undefined once the path walks off an object', () => {
    expect(resolvePath({ a: 'x' }, 'a.b')).toBeUndefined();
  });

  test('returns undefined when the root is not an object', () => {
    expect(resolvePath('not-an-object', 'a')).toBeUndefined();
  });
});

describe('getRootName', () => {
  test('returns the first segment of a dotted path', () => {
    expect(getRootName('foo.bar.baz')).toBe('foo');
  });

  test('returns the whole name when there is no dot', () => {
    expect(getRootName('foo')).toBe('foo');
  });
});

describe('resolveValue', () => {
  test('resolves string, number, and boolean nodes to their literal value', () => {
    expect(resolveValue({ kind: 'string', value: 'x' }, {})).toBe('x');
    expect(resolveValue({ kind: 'number', value: 5 }, {})).toBe(5);
    expect(resolveValue({ kind: 'boolean', value: true }, {})).toBe(true);
  });

  test('resolves an array node element by element', () => {
    expect(
      resolveValue(
        {
          kind: 'array',
          value: [
            { kind: 'number', value: 1 },
            { kind: 'string', value: 'a' },
          ],
        },
        {},
      ),
    ).toStrictEqual([1, 'a']);
  });

  test('resolves an object node key by key', () => {
    expect(
      resolveValue({ kind: 'object', value: { a: { kind: 'string', value: 'x' } } }, {}),
    ).toStrictEqual({ a: 'x' });
  });

  test('substitutes resolvable template expressions with string, number, boolean, and object values', () => {
    const warnSpy = vi.spyOn(globalThis.console, 'warn').mockImplementation(() => {});

    expect(
      resolveValue({ kind: 'template', raw: `hi ${templateVar('name')}` }, { name: 'world' }),
    ).toBe('hi world');
    expect(resolveValue({ kind: 'template', raw: `n=${templateVar('n')}` }, { n: 5 })).toBe('n=5');
    expect(resolveValue({ kind: 'template', raw: `f=${templateVar('f')}` }, { f: true })).toBe(
      'f=true',
    );
    expect(resolveValue({ kind: 'template', raw: `o=${templateVar('o')}` }, { o: { a: 1 } })).toBe(
      'o={"a":1}',
    );

    warnSpy.mockRestore();
  });

  test('substitutes an empty string and warns for an unresolved template variable', () => {
    const warnSpy = vi.spyOn(globalThis.console, 'warn').mockImplementation(() => {});

    expect(resolveValue({ kind: 'template', raw: `hi ${templateVar('missing')}` }, {})).toBe('hi ');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unresolved template variable'),
      expect.anything(),
    );

    warnSpy.mockRestore();
  });

  test('calls a resolvable function reference with resolved arguments', () => {
    const ctx = { double: (n: number) => n * 2 };
    expect(
      resolveValue({ args: [{ kind: 'number', value: 3 }], kind: 'call', name: 'double' }, ctx),
    ).toBe(6);
  });

  test('warns and returns undefined when a call target is missing from ctx', () => {
    const warnSpy = vi.spyOn(globalThis.console, 'warn').mockImplementation(() => {});

    expect(resolveValue({ args: [], kind: 'call', name: 'missingFn' }, {})).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Missing function in ctx'),
      expect.anything(),
    );

    warnSpy.mockRestore();
  });

  test('warns and returns undefined when a call target resolves to a non-function', () => {
    const warnSpy = vi.spyOn(globalThis.console, 'warn').mockImplementation(() => {});

    expect(
      resolveValue({ args: [], kind: 'call', name: 'notAFn' }, { notAFn: { nope: true } }),
    ).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('is not a function'),
      expect.anything(),
    );

    warnSpy.mockRestore();
  });

  test('resolves a ref node via a dotted ctx path', () => {
    expect(resolveValue({ kind: 'ref', name: 'a.b' }, { a: { b: 42 } })).toBe(42);
  });

  test('warns and returns undefined for an unresolved ref', () => {
    const warnSpy = vi.spyOn(globalThis.console, 'warn').mockImplementation(() => {});

    expect(resolveValue({ kind: 'ref', name: 'missing' }, {})).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unresolved reference'),
      expect.anything(),
    );

    warnSpy.mockRestore();
  });

  test('warns and returns undefined for an "unknown" node', () => {
    const warnSpy = vi.spyOn(globalThis.console, 'warn').mockImplementation(() => {});

    expect(resolveValue({ kind: 'unknown', raw: '???' }, {})).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown AST node'), '???');

    warnSpy.mockRestore();
  });

  test('warns and returns undefined for a node with an unrecognized kind', () => {
    const warnSpy = vi.spyOn(globalThis.console, 'warn').mockImplementation(() => {});
    const malformedNode = makeMalformedNode();

    expect(resolveValue(malformedNode, {})).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unhandled AST node kind'),
      malformedNode,
    );

    warnSpy.mockRestore();
  });
});

describe('collectRefNames', () => {
  test('collects root ref names from arrays, objects, calls, and refs', () => {
    const acc = new Set<string>();
    collectRefNames(
      {
        kind: 'array',
        value: [
          { kind: 'ref', name: 'a.deep' },
          {
            kind: 'object',
            value: {
              nested: { args: [{ kind: 'ref', name: 'x' }], kind: 'call', name: 'ns.fn' },
            },
          },
        ],
      },
      acc,
    );
    expect([...acc].toSorted()).toStrictEqual(['a', 'ns', 'x']);
  });

  test('collects root ref names referenced inside template expressions', () => {
    const acc = new Set<string>();
    collectRefNames(
      { kind: 'template', raw: `a ${templateVar('x.y')} b ${templateVar('z')}` },
      acc,
    );
    expect([...acc].toSorted()).toStrictEqual(['x', 'z']);
  });

  test('does not add anything for string, number, boolean, or unknown nodes', () => {
    const acc = new Set<string>();
    collectRefNames({ kind: 'string', value: 'x' }, acc);
    collectRefNames({ kind: 'number', value: 1 }, acc);
    collectRefNames({ kind: 'boolean', value: false }, acc);
    collectRefNames({ kind: 'unknown', raw: '?' }, acc);
    expect(acc.size).toBe(0);
  });

  test('does not add anything for a node with an unrecognized kind', () => {
    const acc = new Set<string>();
    collectRefNames(makeMalformedNode(), acc);
    expect(acc.size).toBe(0);
  });

  test('skips a template placeholder that is whitespace-only once trimmed', () => {
    const acc = new Set<string>();
    collectRefNames({ kind: 'template', raw: templateVar(' ') }, acc);
    expect(acc.size).toBe(0);
  });
});

describe('sortRegistryKeys', () => {
  test('orders dependencies before dependents', () => {
    const registry: Record<string, ASTNode> = {
      a: { kind: 'ref', name: 'b' },
      b: { kind: 'string', value: 'x' },
    };
    const order = sortRegistryKeys(registry);
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('a'));
    expect(order).toHaveLength(2);
  });

  test('ignores a self-referencing key instead of looping forever', () => {
    const registry: Record<string, ASTNode> = {
      c: { kind: 'ref', name: 'c' },
    };
    expect(sortRegistryKeys(registry)).toStrictEqual(['c']);
  });

  test('ignores dependencies that are not present in the registry', () => {
    const registry: Record<string, ASTNode> = {
      d: { kind: 'ref', name: 'external' },
    };
    expect(sortRegistryKeys(registry)).toStrictEqual(['d']);
  });

  test('breaks a mutual reference cycle via the visiting guard', () => {
    const registry: Record<string, ASTNode> = {
      a: { kind: 'ref', name: 'b' },
      b: { kind: 'ref', name: 'a' },
    };
    const order = sortRegistryKeys(registry);
    expect([...order].toSorted()).toStrictEqual(['a', 'b']);
  });
});

describe('compileStylesRegistry', () => {
  test('resolves plain values and exposes them to later keys in the registry', () => {
    const registry: Record<string, ASTNode> = {
      firstStyles: { kind: 'string', value: 'X' },
      secondStyles: { kind: 'ref', name: 'firstStyles' },
    };
    const resolved = compileStylesRegistry(registry);
    expect(resolved['firstStyles']).toBe('X');
    expect(resolved['secondStyles']).toBe('X');
  });

  test('exposes baseStyles-family helpers on the resolution context', () => {
    const registry: Record<string, ASTNode> = {
      callStyles: {
        args: [{ kind: 'string', value: 'primary' }],
        kind: 'call',
        name: 'intentSolid',
      },
    };
    const resolved = compileStylesRegistry(registry);
    expect(resolved['callStyles']).toBe(intentSolid('primary'));
  });
});

describe('extractStylesFromFile', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'style-compiler-test-'));

  test('extracts only top-level const/let declarations whose name ends in "Styles" and has an initializer', () => {
    const file = path.join(tmpDir, 'fixture.tsx');
    fs.writeFileSync(
      file,
      [
        'interface Foo { bar: string }',
        'const { destructuredA } = { destructuredA: 1 };',
        'const helperConfig = { a: 1 };',
        'let pendingStyles: string | undefined;',
        "const sampleStyles = { a: 'x', b: 2 };",
        `void destructuredA;`,
      ].join('\n'),
    );

    const result = extractStylesFromFile(file);

    expect(Object.keys(result)).toStrictEqual(['sampleStyles']);
    expect(result['sampleStyles']).toStrictEqual({
      kind: 'object',
      value: {
        a: { kind: 'string', value: 'x' },
        b: { kind: 'number', value: 2 },
      },
    });

    fs.rmSync(file);
  });

  test('returns an empty registry for a file that cannot be read', () => {
    const result = extractStylesFromFile(path.join(tmpDir, 'does-not-exist.tsx'));
    expect(result).toStrictEqual({});
  });
});
