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

const getEnvironmentMode = () => getEnv('ENV')?.toLowerCase() ?? 'local';
const isLocal = () => getEnvironmentMode() === 'local';
const isDevelop = () => getEnvironmentMode() === 'develop';
const isStaging = () => getEnvironmentMode() === 'staging';
const isProduction = () => getEnvironmentMode() === 'production';
const isTest = () => getEnvironmentMode() === 'test';
const isLocalOrTest = () => isLocal() || isTest();
const isDevelopOrStagingOrProduction = () => isDevelop() || isStaging() || isProduction();
const isCi = () => getEnv('CI')?.toLowerCase() === 'true' || getEnv('CI') === '1';
const isDebug = () => getEnv('DEBUG')?.toLowerCase() === 'true' || getEnv('DEBUG') === '1';
const getLogFormat = () => getEnv('LOG_FORMAT');
const getLogLevel = () => getEnv('LOG_LEVEL');

export {
  getEnv,
  getEnvironmentMode,
  isBrowser,
  isLocal,
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
