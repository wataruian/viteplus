import redactObj, { type ConfigOptions } from 'redact-object';

import { type JsonValue, assumeShape } from '../utils/helpers';
import { isCallable, isErrorLike, isRecord } from '../validators/validate';

type RedactFn = (
  target: unknown,
  fields: string[],
  redactValue: string,
  config?: ConfigOptions,
) => JsonValue;

type Serialize = (value: unknown) => JsonValue | undefined;

const defaultRedactValue = '[REDACTED]';

const defaultMaskFields: string[] = [
  'password',
  'password_confirmation',
  'secret',
  'token',
  'apiKey',
  'accessToken',
  'refreshToken',
  'auth',
  'authorization',
  'cookie',
  'set-cookie',
  'api-key',
  'access-token',
  'refresh-token',
  'api_key',
  'access_token',
  'refresh_token',
];

const getRedactFn = (mod: unknown): RedactFn | null => {
  if (isCallable(mod) && assumeShape<RedactFn>(mod)) {
    return mod;
  }

  if (isRecord(mod) && 'default' in mod) {
    const def = mod['default'];
    if (isCallable(def) && assumeShape<RedactFn>(def)) {
      return def;
    }
  }

  return null;
};

const failedRedactionValue = { metadata: '[REDACTION FAILED]' } as const;

const redactedUrlValue = 'REDACTED';

const maxSerializationDepth = 32;

const isSensitiveKey = (key: string, fields: readonly string[]): boolean => {
  const lowerKey = key.toLowerCase();
  return fields.some((field) => lowerKey.includes(field.toLowerCase()));
};

const decodeComponent = (text: string): string =>
  Object.fromEntries(new globalThis.URLSearchParams(`v=${text}`))['v'];

const parseJson = (text: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    const value: unknown = JSON.parse(text);
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
};

const redactJsonParamValue = (rawValue: string, fields: readonly string[]): string | undefined => {
  const decoded = decodeComponent(rawValue).trimStart();
  if (!decoded.startsWith('{') && !decoded.startsWith('[')) {
    return undefined;
  }
  const result = parseJson(decoded);
  if (!result.ok) {
    return undefined;
  }
  const parsed = result.value;
  const failed = encodeURIComponent(JSON.stringify(failedRedactionValue));
  const redactFn = getRedactFn(redactObj);
  if (!redactFn) {
    return failed;
  }
  try {
    const redacted = redactFn(parsed, [...fields], redactedUrlValue, { strict: false });
    const original = JSON.stringify(parsed);
    const serialized = JSON.stringify(redacted);
    return serialized === original ? undefined : encodeURIComponent(serialized);
  } catch {
    return failed;
  }
};

const redactParams = (params: string, fields: readonly string[]): string =>
  params
    .split('&')
    .map((segment) => {
      const separator = segment.indexOf('=');
      if (separator === -1) {
        return segment;
      }
      const rawKey = segment.slice(0, separator);
      const rawValue = segment.slice(separator + 1);
      if (isSensitiveKey(decodeComponent(rawKey), fields)) {
        return `${rawKey}=${redactedUrlValue}`;
      }
      const jsonValue = redactJsonParamValue(rawValue, fields);
      return jsonValue === undefined ? segment : `${rawKey}=${jsonValue}`;
    })
    .join('&');

const userinfoPattern = /^(?<scheme>(?:[a-z][a-z\d+.-]*:)?\/\/)(?<userinfo>[^/]*)@/iu;

const redactUrl = (url: string, fields: readonly string[] = defaultMaskFields): string => {
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? undefined : url.slice(hashIndex + 1);
  const queryIndex = beforeHash.indexOf('?');
  const base = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
  const query = queryIndex === -1 ? undefined : beforeHash.slice(queryIndex + 1);

  const redactedBase = base.replace(userinfoPattern, (_match, scheme: string, userinfo: string) => {
    const masked = userinfo.includes(':')
      ? `${redactedUrlValue}:${redactedUrlValue}`
      : redactedUrlValue;
    return `${scheme}${masked}@`;
  });

  return (
    redactedBase +
    (query === undefined ? '' : `?${redactParams(query, fields)}`) +
    (fragment === undefined ? '' : `#${redactParams(fragment, fields)}`)
  );
};

const stringField = (value: object, key: string): string | undefined => {
  const field: unknown = Reflect.get(value, key);
  return typeof field === 'string' ? field : undefined;
};

const explicitErrorKeys: ReadonlySet<string> = new Set(['cause', 'message', 'name', 'stack']);

const serializePrimitive = (value: unknown): JsonValue | undefined => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return undefined;
};

const serializeEntries = (
  entries: [string, unknown][],
  serialize: Serialize,
): Record<string, JsonValue> => {
  const result: Record<string, JsonValue> = {};
  for (const [key, entry] of entries) {
    const serialized = serialize(entry);
    if (serialized !== undefined) {
      result[key === '__proto__' ? '[__proto__]' : key] = serialized;
    }
  }
  return result;
};

const serializeList = (entries: unknown[], serialize: Serialize): JsonValue =>
  entries.map((entry) => serialize(entry) ?? null);

const mapEntriesWithLabels = (map: Map<unknown, unknown>) => {
  const used = new Set<string>();
  return [...map.entries()].map(([key, entry], index): [string, unknown] => {
    const base =
      (typeof key === 'object' && key !== null) || typeof key === 'function'
        ? `[key ${index + 1}]`
        : String(key);
    let label = base;
    let suffix = 2;
    while (used.has(label)) {
      label = `${base} (${suffix})`;
      suffix += 1;
    }
    used.add(label);
    return [label, entry];
  });
};

const serializeCollection = (value: object, serialize: Serialize): JsonValue | undefined => {
  if (Array.isArray(value)) {
    return serializeList(value, serialize);
  }
  if (value instanceof Set) {
    return serializeList([...value], serialize);
  }
  if (value instanceof Map) {
    return serializeEntries(mapEntriesWithLabels(value), serialize);
  }
  if (value instanceof globalThis.Headers || value instanceof globalThis.URLSearchParams) {
    return serializeEntries([...value.entries()], serialize);
  }
  return undefined;
};

const serializeError = (value: object, serialize: Serialize): JsonValue => {
  const result = serializeEntries(
    Object.entries(value).filter(([key]) => !explicitErrorKeys.has(key)),
    serialize,
  );
  result['message'] = stringField(value, 'message') ?? '';
  result['name'] = stringField(value, 'name') ?? 'Error';
  const stack = stringField(value, 'stack');
  if (stack !== undefined) {
    result['stack'] = stack;
  }
  const cause = serialize(Reflect.get(value, 'cause'));
  if (cause !== undefined) {
    result['cause'] = cause;
  }
  const errors: unknown = Reflect.get(value, 'errors');
  if (!('errors' in result) && Array.isArray(errors)) {
    result['errors'] = serializeList(errors, serialize);
  }
  return result;
};

const serializeForLog = (
  value: unknown,
  fields: readonly string[] = defaultMaskFields,
  ancestors = new Set<object>(),
): JsonValue | undefined => {
  if (value === null || typeof value !== 'object') {
    return serializePrimitive(value);
  }
  if (ancestors.has(value)) {
    return '[Circular]';
  }
  if (ancestors.size >= maxSerializationDepth) {
    return '[Max Depth]';
  }

  const serialize: Serialize = (entry) => serializeForLog(entry, fields, ancestors);
  ancestors.add(value);
  try {
    if (value instanceof globalThis.URL) {
      return redactUrl(value.href, fields);
    }
    const toJson: unknown = Reflect.get(value, 'toJSON');
    if (typeof toJson === 'function') {
      const json: unknown = toJson.call(value);
      if (json !== value) {
        return serialize(json);
      }
    }
    const collection = serializeCollection(value, serialize);
    if (collection !== undefined) {
      return collection;
    }
    if (isErrorLike(value)) {
      return serializeError(value, serialize);
    }
    return serializeEntries(Object.entries(value), serialize);
  } finally {
    ancestors.delete(value);
  }
};

const redactWith = (
  data: unknown,
  fields: readonly string[],
  redactValue: string,
): JsonValue | undefined => {
  const redactFn = getRedactFn(redactObj);

  try {
    const serialized = serializeForLog(data, fields);
    if (serialized === null || typeof serialized !== 'object') {
      return serialized;
    }
    if (!redactFn) {
      return failedRedactionValue;
    }
    return redactFn(serialized, [...fields], redactValue, { ignoreUnknown: true, strict: false });
  } catch {
    return failedRedactionValue;
  }
};

const redact = (
  data: unknown,
  customFields: string[] = [],
  redactValue: string = defaultRedactValue,
): JsonValue | undefined =>
  redactWith(data, [...new Set([...defaultMaskFields, ...customFields])], redactValue);

export {
  decodeComponent,
  defaultMaskFields,
  defaultRedactValue,
  explicitErrorKeys,
  failedRedactionValue,
  getRedactFn,
  isSensitiveKey,
  mapEntriesWithLabels,
  maxSerializationDepth,
  parseJson,
  redact,
  redactJsonParamValue,
  redactParams,
  redactUrl,
  redactWith,
  redactedUrlValue,
  serializeCollection,
  serializeEntries,
  serializeError,
  serializeForLog,
  serializeList,
  serializePrimitive,
  stringField,
  userinfoPattern,
};
export type { RedactFn, Serialize };
