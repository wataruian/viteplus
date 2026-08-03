const getEnv = (key: string, defaultValue?: string): string | undefined => {
  const envGlobal = globalThis as { process?: { env?: Record<string, string | undefined> } };
  if (envGlobal.process?.env !== undefined && envGlobal.process.env[key] !== undefined) {
    return envGlobal.process.env[key];
  }
  return defaultValue;
};

const isBrowser = () =>
  (globalThis as { window?: unknown }).window !== undefined &&
  (globalThis as { document?: unknown }).document !== undefined;

const isTrue = (value = '') => {
  if (value) {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return false;
};

const isFalse = (value = '') => {
  if (value) {
    return value.toLowerCase() === 'false' || value === '0';
  }
  return false;
};

const getEnvName = () => getEnv('ENV')?.toLowerCase() ?? 'local';
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
  getNodeEnv,
  isNodeEnvTest,
  isVitest,
  isTrue,
  isFalse,
  getEnv,
  isOtherEnvironment,
  getEnvName,
  isBrowser,
  isLocal,
  isNonProduction,
  isDevelop,
  isStaging,
  isProduction,
  isTest,
  isLocalOrTest,
  isDevelopOrStagingOrProduction,
  isCi,
  isDebug,
  getLogFormat,
  getLogLevel,
};
