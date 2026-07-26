import type { InvokableFunction } from '../types/parameter';
import { isPlainObject } from '../validators/validate';

const cleanDefaultValue = (val: string): string =>
  val.replace(/^(?<quote>['"`])(?<content>.*)\k<quote>$/u, '$2');

/**
 * Extract parameter name, removing type annotations and default values
 */
const extractParameterName = (paramStr: string): string => {
  if (paramStr.trim().startsWith('{')) {
    let depth = 0;
    let endIndex = -1;
    for (let i = 0; i < paramStr.length; i += 1) {
      const element = paramStr[i];
      if (element === '{') {
        depth += 1;
      } else if (element === '}') {
        depth -= 1;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
    }

    if (endIndex !== -1) {
      return paramStr.slice(0, endIndex + 1);
    }
    return paramStr;
  }

  const match = /^(?<name>[^:=]+)/u.exec(paramStr);
  return match?.[1]?.trim() ?? paramStr.trim();
};

/**
 * Split parameters string into tokens, respecting nested brackets and parentheses
 */
const splitParametersRespectingBrackets = (paramsStr: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let inSquareBrackets = 0;
  let inCurlyBrackets = 0;
  let inParentheses = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < paramsStr.length; i += 1) {
    const char = paramsStr[i];
    const prevChar = i > 0 ? paramsStr[i - 1] : '';

    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
      current += char;
      continue;
    }

    if (inString) {
      current += char;
      if (char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = '';
      }
      continue;
    }

    switch (char) {
      case '(': {
        inParentheses += 1;
        break;
      }
      case ')': {
        inParentheses -= 1;
        break;
      }
      case '[': {
        inSquareBrackets += 1;
        break;
      }
      case ']': {
        inSquareBrackets -= 1;
        break;
      }
      case '{': {
        inCurlyBrackets += 1;
        break;
      }
      case '}': {
        inCurlyBrackets -= 1;
        break;
      }
      default: {
        break;
      }
    }

    const depth = inSquareBrackets + inCurlyBrackets + inParentheses;

    if (char === ',' && depth === 0) {
      tokens.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
};

/**
 * Extracts parameter names and their default values from a function.
 * Strips quotes from string default values.
 */
const extractParamNamesAndDefaults = (fn: InvokableFunction): { name: string }[] => {
  const fnStr = fn
    .toString()
    .replaceAll(/\/\*.*?\*\//gu, '')
    .replaceAll(/\/\/.*$/gmu, '');

  const paramsStr = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).trim();

  if (!paramsStr) {
    return [];
  }

  const paramTokens = splitParametersRespectingBrackets(paramsStr);

  return paramTokens
    .filter((token) => token.length > 0)
    .map((token) => ({
      name: extractParameterName(token),
    }));
};

/**
 * Normalizes input (object, array, or primitive) to an array of arguments matching the function signature.
 * @param fn The target function.
 * @param input The input from HTTP body or tRPC input.
 * @returns Array of arguments to spread into the function.
 */
const normalizeArgs = (fn: InvokableFunction, input: unknown): unknown[] => {
  let paramNames = extractParamNamesAndDefaults(fn);
  const lastParam = paramNames.at(-1);

  if (
    paramNames.length > 1 &&
    paramNames[0].name.trim().startsWith('{') &&
    (lastParam?.name.trim().endsWith('}') ?? false)
  ) {
    const joined = paramNames.map((p) => p.name).join(', ');
    paramNames = [{ name: joined }];
  }

  if (
    paramNames.length === 1 &&
    paramNames[0].name.trim().startsWith('{') &&
    paramNames[0].name.trim().endsWith('}')
  ) {
    return [input ?? {}];
  }
  if (paramNames.length === 1 && !paramNames[0].name.trim().startsWith('{')) {
    return [input ?? {}];
  }

  if (Array.isArray(input)) {
    return input.slice(0, paramNames.length);
  }
  if (isPlainObject(input)) {
    return paramNames.map((p) => input[p.name]);
  }
  if (paramNames.length === 0) {
    return [];
  }
  return [input];
};

/**
 * Invokes a target function with normalized arguments from HTTP or tRPC input.
 * @param fn The target function to invoke.
 * @param input The input from HTTP body or tRPC input.
 * @returns The result of the invoked function.
 */
const invokeWithParsedArgs = (fn: InvokableFunction, input: unknown): unknown =>
  Reflect.apply(fn, undefined, normalizeArgs(fn, input)) as unknown;

export {
  cleanDefaultValue,
  extractParameterName,
  splitParametersRespectingBrackets,
  extractParamNamesAndDefaults,
  normalizeArgs,
  invokeWithParsedArgs,
};
