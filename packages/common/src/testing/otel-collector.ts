import { type ServerType, serve } from '@hono/node-server';

interface RecordedRequest {
  body: unknown;
  headers: Record<string, string>;
  path: string;
}

interface FakeOtelCollector {
  close: () => Promise<void>;
  requestsFor: (path: string) => RecordedRequest[];
  url: string;
  waitForRequest: (
    path: string,
    predicate?: (request: RecordedRequest) => boolean,
    timeoutMs?: number,
  ) => Promise<RecordedRequest>;
}

const pollIntervalMs = 25;
const defaultTimeoutMs = 20_000;

const decodeBody = async (request: Request): Promise<unknown> => {
  if (!request.body) {
    return '';
  }

  const decoded =
    request.headers.get('content-encoding') === 'gzip'
      ? request.body.pipeThrough(new globalThis.DecompressionStream('gzip'))
      : request.body;

  const text = await new globalThis.Response(decoded).text();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const startFakeOtelCollector = async (): Promise<FakeOtelCollector> => {
  const requests: RecordedRequest[] = [];

  const handleRequest = async (request: Request): Promise<Response> => {
    const requestUrl = new globalThis.URL(request.url);

    requests.push({
      body: await decodeBody(request),
      headers: Object.fromEntries(request.headers),
      path: `${requestUrl.pathname}${requestUrl.search}`,
    });

    return new globalThis.Response('{}', { headers: { 'Content-Type': 'application/json' } });
  };

  const server = await new Promise<ServerType>((resolve) => {
    const instance = serve({ fetch: handleRequest, hostname: '127.0.0.1', port: 0 }, () => {
      resolve(instance);
    });
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to determine the fake OTEL collector address');
  }

  const url = `http://127.0.0.1:${address.port}`;

  const requestsFor = (path: string) => requests.filter((request) => request.path.startsWith(path));

  const waitForRequest = async (
    path: string,
    predicate: (request: RecordedRequest) => boolean = () => true,
    timeoutMs = defaultTimeoutMs,
    deadline: number = Date.now() + timeoutMs,
  ): Promise<RecordedRequest> => {
    const match = requestsFor(path).find((request) => predicate(request));
    if (match) {
      return match;
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for a request to ${path}`);
    }
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, pollIntervalMs);
    });
    return waitForRequest(path, predicate, timeoutMs, deadline);
  };

  const close = async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  };

  return { close, requestsFor, url, waitForRequest };
};

export { decodeBody, startFakeOtelCollector };
export type { FakeOtelCollector, RecordedRequest };
