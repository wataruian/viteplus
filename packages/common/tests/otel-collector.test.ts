import zlib from 'node:zlib';

import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';

import {
  type FakeOtelCollector,
  decodeBody,
  startFakeOtelCollector,
} from '../src/testing/otel-collector';
import { sleep } from '../src/utils/time';

describe('decodeBody', () => {
  test('returns an empty string when the request has no body', async () => {
    const request = new globalThis.Request('http://example.com', { method: 'GET' });
    expect(await decodeBody(request)).toBe('');
  });

  test('parses a JSON request body', async () => {
    const request = new globalThis.Request('http://example.com', {
      body: JSON.stringify({ a: 1 }),
      method: 'POST',
    });
    expect(await decodeBody(request)).toStrictEqual({ a: 1 });
  });

  test('falls back to raw text when the body is not valid JSON', async () => {
    const request = new globalThis.Request('http://example.com', {
      body: 'plain text body',
      method: 'POST',
    });
    expect(await decodeBody(request)).toBe('plain text body');
  });

  test('gunzips a gzip content-encoded body before parsing it as JSON', async () => {
    const gzipped = zlib.gzipSync(globalThis.Buffer.from(JSON.stringify({ hello: 'world' })));
    const request = new globalThis.Request('http://example.com', {
      body: gzipped,
      headers: { 'content-encoding': 'gzip' },
      method: 'POST',
    });
    expect(await decodeBody(request)).toStrictEqual({ hello: 'world' });
  });
});

const notStartedCollector: FakeOtelCollector = {
  close: async () => {
    await Promise.resolve();
  },
  requestsFor: () => [],
  url: '',
  waitForRequest: () => {
    throw new Error('collector not started');
  },
};

describe('startFakeOtelCollector', () => {
  let collector: FakeOtelCollector = notStartedCollector;

  beforeEach(async () => {
    collector = await startFakeOtelCollector();
  });

  afterEach(async () => {
    await collector.close().catch(() => {});
  });

  test('exposes a URL that requests can be sent to', () => {
    expect(collector.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u);
  });

  test('records requests including path, query string, headers, and body', async () => {
    await globalThis.fetch(`${collector.url}/v1/traces?foo=bar`, {
      body: JSON.stringify({ resourceSpans: [] }),
      headers: { 'content-type': 'application/json', 'x-custom-header': 'yes' },
      method: 'POST',
    });

    const recorded = collector.requestsFor('/v1/traces');
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.path).toBe('/v1/traces?foo=bar');
    expect(recorded[0]?.body).toStrictEqual({ resourceSpans: [] });
    expect(recorded[0]?.headers['x-custom-header']).toBe('yes');
  });

  test('requestsFor filters by path prefix and excludes non-matching paths', async () => {
    await globalThis.fetch(`${collector.url}/v1/traces`, { method: 'POST' });
    await globalThis.fetch(`${collector.url}/v1/metrics`, { method: 'POST' });

    expect(collector.requestsFor('/v1/traces')).toHaveLength(1);
    expect(collector.requestsFor('/v1/metrics')).toHaveLength(1);
    expect(collector.requestsFor('/v1/logs')).toHaveLength(0);
  });

  test('responds with a JSON body to every recorded request', async () => {
    const response = await globalThis.fetch(`${collector.url}/v1/traces`, { method: 'POST' });
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toStrictEqual({});
  });

  test('waitForRequest resolves immediately when a matching request already arrived', async () => {
    await globalThis.fetch(`${collector.url}/v1/logs`, { method: 'POST' });
    const match = await collector.waitForRequest('/v1/logs');
    expect(match.path).toBe('/v1/logs');
  });

  test('waitForRequest polls until a request eventually arrives', async () => {
    const waiting = collector.waitForRequest('/v1/delayed');

    await sleep(60);
    await globalThis.fetch(`${collector.url}/v1/delayed`, { method: 'POST' });

    const match = await waiting;
    expect(match.path).toBe('/v1/delayed');
  });

  test('waitForRequest polls until the predicate matches a later request', async () => {
    const waiting = collector.waitForRequest('/v1/predicate', (request) => {
      const { body } = request;
      return typeof body === 'object' && body !== null && 'match' in body && body.match === true;
    });

    await globalThis.fetch(`${collector.url}/v1/predicate`, {
      body: JSON.stringify({ match: false }),
      method: 'POST',
    });
    await sleep(60);
    await globalThis.fetch(`${collector.url}/v1/predicate`, {
      body: JSON.stringify({ match: true }),
      method: 'POST',
    });

    const match = await waiting;
    expect(match.body).toStrictEqual({ match: true });
  });

  test('waitForRequest times out when no matching request ever arrives', async () => {
    await expect(collector.waitForRequest('/v1/never', undefined, 60)).rejects.toThrow(
      /Timed out waiting for a request to \/v1\/never/u,
    );
  });

  test('close resolves and closing an already-closed collector rejects', async () => {
    await expect(collector.close()).resolves.toBeUndefined();
    await expect(collector.close()).rejects.toThrow();
  });
});
