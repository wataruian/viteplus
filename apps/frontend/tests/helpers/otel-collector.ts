import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { gunzipSync } from 'node:zlib';

interface RecordedRequest {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
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

const parseBody = (decoded: Buffer): unknown => {
  try {
    return JSON.parse(decoded.toString('utf8')) as unknown;
  } catch {
    return decoded.toString('utf8');
  }
};

const startFakeOtelCollector = async (): Promise<FakeOtelCollector> => {
  const requests: RecordedRequest[] = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      const decoded = req.headers['content-encoding'] === 'gzip' ? gunzipSync(raw) : raw;

      requests.push({ body: parseBody(decoded), headers: req.headers, path: req.url ?? '' });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
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

export { startFakeOtelCollector };
export type { FakeOtelCollector, RecordedRequest };
