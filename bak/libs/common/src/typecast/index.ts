// Validate value against a type predicate
const assertType = <T>(
  value: unknown,
  predicate: (val: unknown) => val is T
): T => {
  if (predicate(value)) {
    return value;
  }
  throw new TypeError('Value does not match the expected type');
};

// Create a type guard for complex object shapes
const createTypeGuard = <T extends Record<string, unknown>>(
  shape: {
    [K in keyof T]: (val: unknown) => val is T[K];
  }
): ((val: unknown) => val is T) => {
  return (val: unknown): val is T => {
    if (val === null || typeof val !== 'object') {
      return false;
    }

    for (const key in shape) {
      if (Object.hasOwn(shape, key)) {
        const predicate = shape[key];
        const value = (val as Record<string, unknown>)[key];

        if (!predicate(value)) {
          return false;
        }
      }
    }

    return true;
  };
};

// Merge multiple objects with deep type preservation
const deepMerge = <T extends Record<string, unknown>>(...objects: T[]): T => {
  const result: Record<string, unknown> = {};

  for (const obj of objects) {
    for (const [key, value] of Object.entries(obj)) {
      const resultValue = result[key];

      result[key] =
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        resultValue !== null &&
        typeof resultValue === 'object' &&
        !Array.isArray(resultValue)
          ? deepMerge(
              resultValue as Record<string, unknown>,
              value as Record<string, unknown>
            )
          : value;
    }
  }

  return result as T;
};

export { assertType, createTypeGuard, deepMerge };
