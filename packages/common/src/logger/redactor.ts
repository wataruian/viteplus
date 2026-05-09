import type { RedactFn } from './types';
import { isRecord } from '../validators/validate';
import redactObj from 'redact-object';

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

const isFunc = (val: unknown): val is RedactFn => typeof val === 'function';

const getRedactFn = (mod: unknown): RedactFn | null => {
  if (isFunc(mod)) {
    return mod;
  }
  if (isRecord(mod) && 'default' in mod) {
    const def = mod['default'];
    if (isFunc(def)) {
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

export { defaultRedactValue, defaultMaskFields, isFunc, getRedactFn, redact };
