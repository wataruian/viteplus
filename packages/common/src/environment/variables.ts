import { defaultFaroEndpoint, defaultOtlpEndpoint } from '../configs/telemetry';
import { getEnv, isTrue } from './env';

const getBackendBaseUrl = () => getEnv('BACKEND_URL') ?? 'http://localhost:2000';
const getFrontendUrl = () => getEnv('FRONTEND_URL') ?? 'http://localhost:2001';
const getApiBaseUrl = () => getEnv('API_URL') ?? 'http://localhost:3000';
const getAdminUrl = () => getEnv('ADMIN_URL') ?? 'http://localhost:3001';
const getSiteUrl = () => getEnv('SITE_URL') ?? 'http://localhost:3002';

const getServiceName = () => getEnv('SERVICE_NAME') ?? '@lightproject/app';
const getServiceVersion = () => getEnv('SERVICE_VERSION') ?? '1.0.0';
const getDeploymentEnvironment = () => getEnv('ENV') ?? 'local';
const getOtlpEndpoint = () => getEnv('OTLP_ENDPOINT') ?? defaultOtlpEndpoint;
const getFaroEndpoint = () => getEnv('FARO_ENDPOINT') ?? defaultFaroEndpoint;
const getOtelServiceName = () => getEnv('OTEL_SERVICE_NAME') ?? 'application';
const getChalkLevel = () => getEnv('CHALK_LEVEL');
const isTelemetryDebug = () => isTrue(getEnv('TELEMETRY_DEBUG'));

export {
  getAdminUrl,
  getApiBaseUrl,
  getBackendBaseUrl,
  getChalkLevel,
  getDeploymentEnvironment,
  getFaroEndpoint,
  getFrontendUrl,
  getOtelServiceName,
  getOtlpEndpoint,
  getServiceName,
  getServiceVersion,
  getSiteUrl,
  isTelemetryDebug,
};
