import redactObj from 'redact-object';

import { isCallable, isRecord } from '../validators/validate';

type RedactFn = (target: unknown, fields: string[], redactValue: string) => unknown;

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
  if (isCallable(mod)) {
    return mod;
  }

  if (isRecord(mod) && 'default' in mod) {
    const def = mod['default'];
    if (isCallable(def)) {
      return def;
    }
  }

  return null;
};

const redact = (
  data: unknown,
  customFields: string[] = [],
  redactValue: string = defaultRedactValue,
): unknown => {
  if (data === null || typeof data !== 'object') {
    return data;
  }

  const redactFn = getRedactFn(redactObj);

  if (!redactFn) {
    return data;
  }

  const fieldsToMask = [...new Set([...defaultMaskFields, ...customFields])];

  try {
    let target: unknown = data;
    try {
      target = globalThis.structuredClone(data);
    } catch {
      target = isRecord(data) ? { ...data } : data;
    }

    return redactFn(target, fieldsToMask, redactValue);
  } catch {
    return data;
  }
};

export { defaultMaskFields, defaultRedactValue, getRedactFn, redact };
export type { RedactFn };
