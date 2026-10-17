import { getImportMetaEnvValue } from '#import-meta-env';

const vitePrefix = 'VITE_';

const hasEnvProperty = (obj: object): obj is object & { env: Record<string, string | undefined> } =>
  'env' in obj;

const getProcessEnv = (key: string): string | undefined => {
  try {
    const envGlobal = globalThis as { process?: { env?: Record<string, string | undefined> } };
    const value = envGlobal.process?.env?.[key];
    if (value !== undefined) {
      return value;
    }
  } catch {
    // Ignore error
  }

  return undefined;
};

const getImportMetaEnv = (key: string): string | undefined => {
  try {
    const value = getImportMetaEnvValue(key);
    if (value !== undefined) {
      return value;
    }
  } catch {
    // Ignore error
  }

  return undefined;
};

const getEnvVar = (key: string): string | undefined => getProcessEnv(key) ?? getImportMetaEnv(key);

const getEnv = (key: string, defaultValue?: string): string | undefined =>
  getEnvVar(key) ??
  (key.startsWith(vitePrefix) ? undefined : getEnvVar(`${vitePrefix}${key}`)) ??
  defaultValue;

const isTrue = (value = '') => {
  if (value) {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return false;
};

const isFalse = (value = '') => !value || value.toLowerCase() === 'false' || value === '0';

const isBrowser = () =>
  (globalThis as { window?: unknown }).window !== undefined &&
  (globalThis as { document?: unknown }).document !== undefined;

const isEdge = () => {
  if ('EdgeRuntime' in globalThis) {
    return true;
  }
  if ('Deno' in globalThis) {
    return true;
  }
  if (
    (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ===
    'Cloudflare-Workers'
  ) {
    return true;
  }

  return !isBrowser() && typeof process === 'undefined';
};

const isNode = () =>
  !isEdge() &&
  typeof globalThis !== 'undefined' &&
  (globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node !==
    undefined;

export { getEnv, hasEnvProperty, isBrowser, isEdge, isFalse, isNode, isTrue, vitePrefix };
