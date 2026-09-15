import { getImportMetaEnvValue } from '#import-meta-env';

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

const getEnv = (key: string, defaultValue?: string): string | undefined =>
  getProcessEnv(key) ?? getImportMetaEnv(key) ?? defaultValue;

const isBrowser = () =>
  (globalThis as { window?: unknown }).window !== undefined &&
  (globalThis as { document?: unknown }).document !== undefined;

const isTrue = (value = '') => {
  if (value) {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return false;
};

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

const isFalse = (value = '') => !value || value.toLowerCase() === 'false' || value === '0';

const getEnvName = () =>
  getEnv('ENV')?.toLowerCase() ?? getEnv('VITE_ENV')?.toLowerCase() ?? 'local';
const getNodeEnv = () => getEnv('NODE_ENV');
const isNodeEnvTest = () => getNodeEnv() === 'test';
const isLocal = () => getEnvName() === 'local';
const isDevelop = () => getEnvName() === 'develop';
const isStaging = () => getEnvName() === 'staging';
const isProduction = () => getEnvName() === 'production';
const isVitest = () => isTrue(getEnv('VITEST'));
const isTest = () => getEnvName() === 'test';
const isLocalOrTest = () => isLocal() || isTest();
const isDevelopOrStagingOrProduction = () => isDevelop() || isStaging() || isProduction();
const isCi = () => isTrue(getEnv('CI'));
const isDebug = () => isTrue(getEnv('DEBUG'));
const getLogFormat = () => getEnv('LOG_FORMAT');
const getLogLevel = () => getEnv('LOG_LEVEL');

const isNonProduction = () =>
  (isCi() || isTest() || isLocal() || isDevelop() || isStaging()) && !isProduction();

const isOtherEnvironment = (environment = '') => {
  let isOtherEnv =
    !(isCi() || isTest() || isLocal() || isDevelop() || isStaging() || isProduction()) &&
    getEnvName() !== '';

  if (isOtherEnv && environment.trim().length > 0) {
    isOtherEnv = getEnvName() === environment;
  }

  return isOtherEnv;
};

export {
  getEnv,
  getEnvName,
  getLogFormat,
  getLogLevel,
  getNodeEnv,
  hasEnvProperty,
  isBrowser,
  isCi,
  isDebug,
  isDevelop,
  isDevelopOrStagingOrProduction,
  isEdge,
  isFalse,
  isLocal,
  isLocalOrTest,
  isNode,
  isNodeEnvTest,
  isNonProduction,
  isOtherEnvironment,
  isProduction,
  isStaging,
  isTest,
  isTrue,
  isVitest,
};
