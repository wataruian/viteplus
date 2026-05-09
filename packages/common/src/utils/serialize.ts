import { isRecord } from '../validators/validate';

const defaultIgnoredKeys = new Set(['_readableState', '_writableState', 'parser', 'socket']);

const safeSerialize = (value: unknown, ignoredKeys?: string[]): unknown => {
  const seen = new WeakSet<object>();

  if (ignoredKeys) {
    for (const key of ignoredKeys) {
      defaultIgnoredKeys.add(key);
    }
  }

  return JSON.parse(
    JSON.stringify(value, (key, val: unknown) => {
      if (defaultIgnoredKeys.has(key)) {
        return '[Circular]';
      }

      if (val !== undefined && typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return '[Circular]';
        }
        seen.add(val);
      }
      return val;
    }),
  );
};

const safeClone = (source: unknown): unknown => {
  if (source === null || typeof source !== 'object') {
    return source;
  }

  if (Array.isArray(source)) {
    return source.map((item: unknown) => safeClone(item));
  }

  if (!isRecord(source)) {
    return source;
  }

  const result: Record<string, unknown> = {};
  const sourceRecord = source;
  for (const key in sourceRecord) {
    if (Object.hasOwn(sourceRecord, key)) {
      try {
        const value = sourceRecord[key];
        if (typeof value !== 'function' && value !== undefined) {
          result[key] = safeClone(value);
        }
      } catch {
        // Ignore errors when accessing properties
      }
    }
  }
  return result;
};

export { defaultIgnoredKeys, safeClone, safeSerialize };
