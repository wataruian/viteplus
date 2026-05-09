import { isNonNullObject } from '../validators/validate';

const assertType = <T>(value: unknown, predicate: (val: unknown) => val is T): T => {
  if (predicate(value)) {
    return value;
  }
  throw new TypeError('Value does not match the expected type');
};

const createTypeGuard =
  <T extends Record<string, unknown>>(shape: {
    [K in keyof T]: (val: unknown) => val is T[K];
  }): ((val: unknown) => val is T) =>
  (val: unknown): val is T => {
    if (!isNonNullObject(val)) {
      return false;
    }

    for (const key in shape) {
      if (Object.hasOwn(shape, key)) {
        const predicate = shape[key];
        const value: unknown = val[key];

        if (!predicate(value)) {
          return false;
        }
      }
    }

    return true;
  };

const deepMerge = (...objects: Record<string, unknown>[]): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const obj of objects) {
    for (const [key, value] of Object.entries(obj)) {
      const resultValue = result[key];

      result[key] =
        isNonNullObject(value) && isNonNullObject(resultValue)
          ? deepMerge(resultValue, value)
          : value;
    }
  }

  return result;
};

export { assertType, createTypeGuard, deepMerge };
