const IGNORED_KEYS = new Set([
  '_readableState',
  '_writableState',
  'parser',
  'socket',
]);

const safeSerialize = (value: unknown, ignoredKeys?: string[]): unknown => {
  const seen = new WeakSet();

  if (ignoredKeys) {
    for (const key of ignoredKeys) {
      IGNORED_KEYS.add(key);
    }
  }

  return JSON.parse(
    JSON.stringify(value, (key, val) => {
      if (IGNORED_KEYS.has(key)) {
        return '[Circular]';
      }

      if (val !== undefined && typeof val === 'object') {
        if (seen.has(val)) {
          return '[Circular]';
        }
        seen.add(val);
      }
      return val;
    })
  );
};

const safeClone = <T>(source: T): T => {
  if (source === null || typeof source !== 'object') {
    return source;
  }

  if (Array.isArray(source)) {
    return source.map(item => safeClone(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const key in source) {
    if (Object.hasOwn(source, key)) {
      try {
        const value = source[key as keyof T];
        if (typeof value !== 'function' && value !== undefined) {
          result[key] = safeClone(value);
        }
      } catch {
        // Ignore errors when accessing properties
      }
    }
  }
  return result as T;
};

export { IGNORED_KEYS, safeClone, safeSerialize };
