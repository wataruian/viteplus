import { defaultFaroEndpoint, defaultOtlpEndpoint } from '../configs/telemetry';
import { commonEnv } from './schema';

const getBackendBaseUrl = () => commonEnv.BACKEND_URL ?? 'http://localhost:2000';
const getFrontendUrl = () => commonEnv.FRONTEND_URL ?? 'http://localhost:2001';
const getApiBaseUrl = () => commonEnv.API_URL ?? 'http://localhost:3000';
const getAdminUrl = () => commonEnv.ADMIN_URL ?? 'http://localhost:3001';
const getSiteUrl = () => commonEnv.SITE_URL ?? 'http://localhost:3002';

const getServiceName = () => commonEnv.SERVICE_NAME;
const getServiceVersion = () => commonEnv.SERVICE_VERSION;
const getOtlpEndpoint = () => commonEnv.OTLP_ENDPOINT ?? defaultOtlpEndpoint;
const getFaroEndpoint = () => commonEnv.FARO_ENDPOINT ?? defaultFaroEndpoint;
const getOtelServiceName = () => commonEnv.OTEL_SERVICE_NAME;
const getChalkLevel = () => commonEnv.CHALK_LEVEL;
const isTelemetryDebug = () => commonEnv.TELEMETRY_DEBUG;

const getEnvName = () => commonEnv.ENV;
const getDeploymentEnvironment = getEnvName;
const getNodeEnv = () => commonEnv.NODE_ENV;
const getLogFormat = () => commonEnv.LOG_FORMAT;
const getLogLevel = () => commonEnv.LOG_LEVEL;

const isNodeEnvTest = () => getNodeEnv() === 'test';
const isLocal = () => getEnvName() === 'local';
const isDevelop = () => getEnvName() === 'develop';
const isStaging = () => getEnvName() === 'staging';
const isProduction = () => getEnvName() === 'production';
const isTest = () => getEnvName() === 'test';
const isLocalOrTest = () => isLocal() || isTest();
const isDevelopOrStagingOrProduction = () => isDevelop() || isStaging() || isProduction();
const isVitest = () => commonEnv.VITEST;
const isCi = () => commonEnv.CI;
const isDebug = () => commonEnv.DEBUG;

const isNonProduction = () =>
  (isCi() || isTest() || isLocal() || isDevelop() || isStaging()) && !isProduction();

export {
  getAdminUrl,
  getApiBaseUrl,
  getBackendBaseUrl,
  getChalkLevel,
  getDeploymentEnvironment,
  getEnvName,
  getFaroEndpoint,
  getFrontendUrl,
  getLogFormat,
  getLogLevel,
  getNodeEnv,
  getOtelServiceName,
  getOtlpEndpoint,
  getServiceName,
  getServiceVersion,
  getSiteUrl,
  isCi,
  isDebug,
  isDevelop,
  isDevelopOrStagingOrProduction,
  isLocal,
  isLocalOrTest,
  isNodeEnvTest,
  isNonProduction,
  isProduction,
  isStaging,
  isTelemetryDebug,
  isTest,
  isVitest,
};
