import { getApp } from '@lightproject/backend';

type BackendFetch = (input: RequestInfo | URL | string, init?: RequestInit) => Promise<Response>;

interface RunningBackend {
  fetch: BackendFetch;
  stop: () => Promise<void>;
  url: string;
}

const startNodeBackend = async (): Promise<RunningBackend> => {
  const app = await getApp();

  return {
    fetch: async (input, init) => {
      const response = await app.request(input, init);
      return response;
    },
    stop: async () => {
      await Promise.resolve();
    },
    url: 'http://backend.test',
  };
};

const startWranglerBackend = async (): Promise<RunningBackend> => {
  const baseUrl = await Promise.resolve(globalThis.process.env['WRANGLER_TEST_BASE_URL']);
  if (baseUrl === undefined) {
    throw new Error('WRANGLER_TEST_BASE_URL is not set; did the wrangler global setup run?');
  }

  return {
    fetch: async (input, init) => {
      const response = await globalThis.fetch(input, init);
      return response;
    },
    stop: async () => {
      await Promise.resolve();
    },
    url: baseUrl,
  };
};

const backendRuntimes = [
  { name: 'node', start: startNodeBackend },
  { name: 'wrangler', start: startWranglerBackend },
] as const;

export { backendRuntimes, startNodeBackend, startWranglerBackend };
export type { BackendFetch, RunningBackend };
