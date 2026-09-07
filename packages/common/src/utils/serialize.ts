import { isRecord } from '../validators/validate';

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type JsonValue = Primitive | { [key: string]: JsonValue } | JsonValue[];

const defaultIgnoredKeys = new Set(['_readableState', '_writableState', 'parser', 'socket']);

const assumeShape = <T extends JsonValue>(_val: JsonValue, _dummy?: T): _val is T => true;

const safeSerialize = <T>(
  value: T,
  ignoredKeys?: string[],
): T extends object ? JsonValue & object : JsonValue => {
  const seen = new WeakSet<object>();

  if (ignoredKeys) {
    for (const key of ignoredKeys) {
      defaultIgnoredKeys.add(key);
    }
  }

  const result = (JSON.parse as (text: string) => JsonValue)(
    JSON.stringify(value, (key, val: JsonValue) => {
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

  type R = T extends object ? JsonValue & object : JsonValue;
  if (assumeShape<R>(result)) {
    return result;
  }
  throw new Error('unreachable: assumeShape always narrows successfully');
};

const safeClone = <T extends JsonValue>(source: T): T => {
  if (source === null || typeof source !== 'object') {
    return source;
  }

  if (Array.isArray(source) && assumeShape<JsonValue[]>(source)) {
    const result = source.map((item: JsonValue) => safeClone(item));
    if (assumeShape<T>(result)) {
      return result;
    }
  }

  if (!isRecord(source) || !assumeShape<Record<string, JsonValue>>(source)) {
    return source;
  }

  const result: Record<string, JsonValue> = {};
  const sourceRecord = source;
  for (const key of Object.keys(sourceRecord)) {
    try {
      const value = sourceRecord[key];
      if (typeof value !== 'function' && value !== undefined) {
        result[key] = safeClone(value);
      }
    } catch {
      // Ignore errors when accessing properties
    }
  }

  if (assumeShape<T>(result)) {
    return result;
  }
  throw new Error('unreachable: assumeShape always narrows successfully');
};

export { assumeShape, defaultIgnoredKeys, safeClone, safeSerialize };
export type { JsonValue, Primitive };
