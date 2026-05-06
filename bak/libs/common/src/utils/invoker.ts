interface ParsedParam {
  defaultValue?: string;
  name: string;
}

const QUOTED_STRING_REGEX = /^(['"`])(.*)\1$/;
const PARAM_NAME_REGEX = /^([^:=]+)/;

const cleanDefaultValue = (val: string): string => {
  return val.replace(QUOTED_STRING_REGEX, '$2');
};

/**
 * Split parameters string into tokens, respecting nested brackets and parentheses
 */
const splitParametersRespectingBrackets = (paramsStr: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let depth = 0;
  let inSquareBrackets = 0;
  let inCurlyBrackets = 0;
  let inParentheses = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < paramsStr.length; i++) {
    const char = paramsStr[i];
    const prevChar = i > 0 ? paramsStr[i - 1] : '';

    // Handle string literals
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

    // Track bracket depth
    switch (char) {
      case '(': {
        inParentheses++;
        break;
      }
      case ')': {
        inParentheses--;
        break;
      }
      case '[': {
        inSquareBrackets++;
        break;
      }
      case ']': {
        inSquareBrackets--;
        break;
      }
      case '{': {
        inCurlyBrackets++;
        break;
      }
      case '}': {
        inCurlyBrackets--;
        break;
      }
      default: {
        // No action needed for other characters
        break;
      }
    }

    depth = inSquareBrackets + inCurlyBrackets + inParentheses;

    // Split on comma only when not inside brackets
    if (char === ',' && depth === 0) {
      tokens.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last token
  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
};

/**
 * Extract parameter name, removing type annotations and default values
 */
const extractParameterName = (paramStr: string): string => {
  // Handle destructured parameters: { foo, bar }: Options = defaultValue
  if (paramStr.trim().startsWith('{')) {
    // Find the closing brace for the destructuring pattern
    let depth = 0;
    let endIndex = -1;

    for (const [i, element] of [...paramStr].entries()) {
      if (element === '{') {
        depth++;
      } else if (element === '}') {
        depth--;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
    }

    if (endIndex !== -1) {
      return paramStr.slice(0, endIndex + 1);
    }
    return paramStr; // Fallback if parsing fails
  }

  // Handle regular parameters: paramName: Type = defaultValue
  // Extract just the parameter name (before colon or equals)
  const match = paramStr.match(PARAM_NAME_REGEX);
  return match?.[1]?.trim() ?? paramStr.trim();
};

/**
 * Extracts parameter names and their default values from a function.
 * Strips quotes from string default values.
 */
const extractParamNamesAndDefaults = (
  fn: (...args: unknown[]) => unknown
): { name: string }[] => {
  const fnStr = fn
    .toString()
    .replaceAll(/\/\*.*?\*\//g, '') // Remove block comments
    .replaceAll(/\/\/.*$/gm, ''); // Remove line comments

  const paramsStr = fnStr
    .slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')'))
    .trim();

  if (!paramsStr) {
    return [];
  }

  // Use bracket-aware splitting instead of naive comma split
  const paramTokens = splitParametersRespectingBrackets(paramsStr);

  return paramTokens
    .filter(token => token.length > 0)
    .map(token => ({
      name: extractParameterName(token),
    }));
};

/**
 * Invokes a target function with normalized arguments from HTTP or tRPC input.
 * @param fn The target function to invoke.
 * @param input The input from HTTP body or tRPC input.
 * @returns The result of the invoked function.
 */
const invokeWithParsedArgs = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  input: unknown
): ReturnType<T> => {
  return fn(...normalizeArgs(fn, input)) as ReturnType<T>;
};

/**
 * Normalizes input (object, array, or primitive) to an array of arguments matching the function signature.
 * @param fn The target function.
 * @param input The input from HTTP body or tRPC input.
 * @returns Array of arguments to spread into the function.
 */
const normalizeArgs = (
  fn: (...args: unknown[]) => unknown,
  input: unknown
): unknown[] => {
  let paramNames = extractParamNamesAndDefaults(fn);

  // Join destructured param names if needed
  if (
    paramNames.length > 1 &&
    paramNames[0] !== undefined &&
    paramNames[0].name.trim().startsWith('{') &&
    !!paramNames.at(-1) &&
    paramNames.at(-1)?.name.trim().endsWith('}')
  ) {
    const joined = paramNames.map(p => p.name).join(', ');
    paramNames = [{ name: joined }];
  }

  // Destructured object param: param name is a full {...} block
  if (
    paramNames.length === 1 &&
    paramNames[0] !== undefined &&
    paramNames[0].name.trim().startsWith('{') &&
    paramNames[0].name.trim().endsWith('}')
  ) {
    return [input ?? {}];
  }

  // Object only param: single param, not destructured
  if (
    paramNames.length === 1 &&
    paramNames[0] !== undefined &&
    !paramNames[0].name.trim().startsWith('{')
  ) {
    return [input ?? {}];
  }

  if (Array.isArray(input)) {
    return input.slice(0, paramNames.length);
  }
  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    return paramNames.map(p => obj[p.name]);
  }
  if (paramNames.length === 0) {
    return [];
  }
  // Single primitive
  return [input];
};

export type { ParsedParam };
export {
  cleanDefaultValue,
  extractParamNamesAndDefaults,
  invokeWithParsedArgs,
  normalizeArgs,
};
