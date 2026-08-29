import { getEnv } from '../environment';

type RequestType = (typeof requestTypes)[keyof typeof requestTypes];

const apiBaseUrl = getEnv('API_URL') ?? getEnv('VITE_API_URL') ?? 'http://localhost:3000';
const adminUrl = getEnv('ADMIN_URL') ?? getEnv('VITE_ADMIN_URL') ?? 'http://localhost:3001';
const siteUrl = getEnv('SITE_URL') ?? getEnv('VITE_SITE_URL') ?? 'http://localhost:3002';

const openApiVersion = '3.0.0';

const healthCheckEndpoint = '/';
const healthCheckUrl = `${apiBaseUrl}${healthCheckEndpoint}`;

const apiEndpoint = '/api';
const apiUrl = `${apiBaseUrl}${apiEndpoint}`;

const docsEndpoint = '/docs';

const docsHttpEndpoint = `${docsEndpoint}/http`;
const docsHttpUrl = `${apiBaseUrl}${docsHttpEndpoint}`;
const openApiHttpJsonEndpoint = `${docsEndpoint}/openapi-http.json`;

const docsTrpcEndpoint = `${docsEndpoint}/trpc`;
const docsTrpcUrl = `${apiBaseUrl}${docsTrpcEndpoint}`;
const openApiTrpcJsonEndpoint = `${docsEndpoint}/openapi-trpc.json`;

const trpcEndpoint = '/trpc';
const trpcUrl = `${apiBaseUrl}${trpcEndpoint}`;

const requestTypes = {
  http: 'HTTP',
  trpc: 'tRPC',
} as const;

const isTrpcEndpoint = (url: string): boolean =>
  url.startsWith(trpcEndpoint) || url.startsWith(trpcUrl);

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
  apiEndpoint,
  apiUrl,
  docsEndpoint,
  docsHttpEndpoint,
  docsHttpUrl,
  docsTrpcEndpoint,
  docsTrpcUrl,
  getRequestType,
  healthCheckEndpoint,
  healthCheckUrl,
  isTrpcEndpoint,
  isTrpcRequest,
  openApiHttpJsonEndpoint,
  openApiTrpcJsonEndpoint,
  openApiVersion,
  requestTypes,
  siteUrl,
  trpcEndpoint,
  trpcUrl,
};
export type { RequestType };
