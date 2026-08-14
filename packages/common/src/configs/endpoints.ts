import { getEnv } from '../environment';

type RequestType = (typeof requestTypes)[keyof typeof requestTypes];

const apiBaseUrl = getEnv('API_URL') ?? getEnv('VITE_API_URL') ?? 'http://localhost:3000';
const adminUrl = getEnv('ADMIN_URL') ?? getEnv('VITE_ADMIN_URL') ?? 'http://localhost:3001';
const siteUrl = getEnv('SITE_URL') ?? getEnv('VITE_SITE_URL') ?? 'http://localhost:3002';

const healthCheckEndpoint = '/';
const healthCheckUrl = `${apiBaseUrl}${healthCheckEndpoint}`;

const apiEndpoint = '/api';
const apiUrl = `${apiBaseUrl}${apiEndpoint}`;

const docsEndpoint = '/docs';
const docsUrl = `${apiBaseUrl}${docsEndpoint}`;

const trpcEndpoint = '/trpc';
const trpcUrl = `${apiBaseUrl}${trpcEndpoint}`;

const trpcPlaygroundEndpoint = '/trpc-playground';
const trpcPlaygroundUrl = `${apiBaseUrl}${trpcPlaygroundEndpoint}`;

const requestTypes = {
  http: 'HTTP',
  trpc: 'tRPC',
} as const;

const isTrpcEndpoint = (url: string): boolean =>
  (url.startsWith(trpcEndpoint) && !url.startsWith(trpcPlaygroundEndpoint)) ||
  (url.startsWith(trpcUrl) && !url.startsWith(trpcPlaygroundUrl));

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
  docsUrl,
  getRequestType,
  healthCheckEndpoint,
  healthCheckUrl,
  isTrpcEndpoint,
  isTrpcRequest,
  requestTypes,
  siteUrl,
  trpcEndpoint,
  trpcPlaygroundEndpoint,
  trpcPlaygroundUrl,
  trpcUrl,
};
export type { RequestType };
