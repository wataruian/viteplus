import {
  getAdminUrl,
  getApiBaseUrl,
  getBackendBaseUrl,
  getFrontendUrl,
  getSiteUrl,
} from '../environment/variables';

type RequestType = (typeof requestTypes)[keyof typeof requestTypes];

const backendBaseUrl = getBackendBaseUrl();
const frontendUrl = getFrontendUrl();
const apiBaseUrl = getApiBaseUrl();
const adminUrl = getAdminUrl();
const siteUrl = getSiteUrl();

const openApiVersion = '3.0.0';

const healthCheckEndpoint = '/';
const httpEndpoint = '/api';
const trpcEndpoint = '/trpc';
const docsEndpoint = '/docs';
const docsHttpEndpoint = `${docsEndpoint}/http`;
const docsTrpcEndpoint = `${docsEndpoint}/trpc`;
const openApiHttpJsonEndpoint = `${docsEndpoint}/openapi-http.json`;
const openApiTrpcJsonEndpoint = `${docsEndpoint}/openapi-trpc.json`;

const backendHealthCheckUrl = `${backendBaseUrl}${healthCheckEndpoint}`;
const apiHealthCheckUrl = `${apiBaseUrl}${healthCheckEndpoint}`;

const backendUrl = `${backendBaseUrl}${httpEndpoint}`;
const apiUrl = `${apiBaseUrl}${httpEndpoint}`;

const backendDocsHttpUrl = `${backendBaseUrl}${docsHttpEndpoint}`;
const apiDocsHttpUrl = `${apiBaseUrl}${docsHttpEndpoint}`;

const backendDocsTrpcUrl = `${backendBaseUrl}${docsTrpcEndpoint}`;
const apiDocsTrpcUrl = `${apiBaseUrl}${docsTrpcEndpoint}`;

const backendTrpcUrl = `${backendBaseUrl}${trpcEndpoint}`;
const apiTrpcUrl = `${apiBaseUrl}${trpcEndpoint}`;

const requestTypes = {
  http: 'HTTP',
  trpc: 'tRPC',
} as const;

const isTrpcEndpoint = (url: string): boolean =>
  (globalThis.URL.parse(url)?.pathname ?? url).startsWith(trpcEndpoint);

const getRequestType = (url: string): RequestType => {
  if (isTrpcEndpoint(url)) {
    return requestTypes.trpc;
  }
  return requestTypes.http;
};

const isTrpcRequest = (requestType: RequestType): boolean => {
  if (requestType === requestTypes.trpc) {
    return true;
  }
  return false;
};

export {
  adminUrl,
  apiBaseUrl,
  apiDocsHttpUrl,
  apiDocsTrpcUrl,
  apiHealthCheckUrl,
  apiTrpcUrl,
  apiUrl,
  backendBaseUrl,
  backendDocsHttpUrl,
  backendDocsTrpcUrl,
  backendHealthCheckUrl,
  backendTrpcUrl,
  backendUrl,
  docsEndpoint,
  docsHttpEndpoint,
  docsTrpcEndpoint,
  frontendUrl,
  getRequestType,
  healthCheckEndpoint,
  httpEndpoint,
  isTrpcEndpoint,
  isTrpcRequest,
  openApiHttpJsonEndpoint,
  openApiTrpcJsonEndpoint,
  openApiVersion,
  requestTypes,
  siteUrl,
  trpcEndpoint,
};
export type { RequestType };
