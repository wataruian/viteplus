import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { z } from 'zod';

const dataPointSchema = z.object({
  attributes: z.array(z.unknown()),
  exemplars: z.array(z.record(z.string(), z.unknown())),
});

const metricsBodySchema = z.object({
  resourceMetrics: z.tuple([
    z.object({
      scopeMetrics: z.tuple([
        z.object({
          metrics: z
            .array(
              z.object({
                name: z.string(),
                sum: z.object({ dataPoints: z.array(dataPointSchema).min(1) }),
              }),
            )
            .min(1),
        }),
      ]),
    }),
  ]),
});

const getSingleDataPoint = (parsedBody: unknown) => {
  const body = metricsBodySchema.parse(parsedBody);
  const [{ scopeMetrics }] = body.resourceMetrics;
  const [{ metrics }] = scopeMetrics;
  const [metric] = metrics;
  const [dataPoint] = metric.sum.dataPoints;
  return dataPoint;
};

const { getSessionIdMock, getTelemetryConfigMock, getTraceContextMock, loggerErrorMock } =
  vi.hoisted(() => ({
    getSessionIdMock: vi.fn(),
    getTelemetryConfigMock: vi.fn(),
    getTraceContextMock: vi.fn(),
    loggerErrorMock: vi.fn(),
  }));

vi.mock('../src/utils/telemetry', () => ({
  getTelemetryConfig: getTelemetryConfigMock,
}));

vi.mock('../src/logger/context', () => ({
  getSessionId: getSessionIdMock,
  getTraceContext: getTraceContextMock,
}));

vi.mock('../src/logger', () => ({
  logger: { error: loggerErrorMock },
}));

const { flushExemplarMetrics, recordGaugeWithExemplar } =
  await import('../src/server/exemplar-metrics');

const parseLastRequestBody = (fetchMock: ReturnType<typeof vi.fn<typeof globalThis.fetch>>) => {
  const lastCall = fetchMock.mock.calls.at(-1);
  if (lastCall === undefined) {
    throw new TypeError('expected fetch to have been called at least once');
  }
  const [url, requestInit] = lastCall;
  if (requestInit === undefined) {
    throw new TypeError('expected fetch to have been called with a RequestInit');
  }

  const { body } = requestInit;
  if (typeof body !== 'string') {
    throw new TypeError('expected the request body to be a JSON string');
  }

  const parsedBody: unknown = JSON.parse(body);
  return { parsedBody, requestInit, url };
};

const setUp = () => {
  getTelemetryConfigMock.mockReturnValue({
    environment: 'test',
    otlpEndpoint: 'http://otlp.example.com',
    serviceName: '@acme/api',
    serviceVersion: '1.0.0',
  });
  const fetchMock = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new globalThis.Response(null, { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  getTraceContextMock.mockReturnValue(undefined);
  getSessionIdMock.mockReturnValue('no-id');
});

afterEach(async () => {
  await flushExemplarMetrics();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('recordGaugeWithExemplar', () => {
  test('does nothing when telemetry has not been initialized', async () => {
    getTelemetryConfigMock.mockReturnValue(undefined);
    const fetchMock = vi.fn<typeof globalThis.fetch>();
    vi.stubGlobal('fetch', fetchMock);

    await recordGaugeWithExemplar({ name: 'test_metric', value: 1 });
    await flushExemplarMetrics();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('drops the buffered batch instead of fetching when telemetry is no longer initialized by flush time', async () => {
    const fetchMock = setUp();

    await recordGaugeWithExemplar({ name: 'http_server_duration_seconds', value: 0.1 });
    getTelemetryConfigMock.mockReturnValue(undefined);
    await flushExemplarMetrics();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('logs an error instead of crashing when the timer-triggered flush itself throws (no caller is awaiting this path)', async () => {
    const fetchMock = setUp();

    const unhandledRejectionSpy = vi.fn();
    const handleUnhandledRejection = (reason: unknown): void => {
      unhandledRejectionSpy(reason);
    };
    globalThis.process.on('unhandledRejection', handleUnhandledRejection);

    await recordGaugeWithExemplar({ name: 'http_server_duration_seconds', value: 0.1 });

    getTelemetryConfigMock.mockImplementationOnce(() => {
      throw new Error('config lookup failed');
    });
    await vi.advanceTimersByTimeAsync(2000);

    expect(unhandledRejectionSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Failed to flush a batch of exemplar metrics',
      expect.any(Object),
    );

    globalThis.process.off('unhandledRejection', handleUnhandledRejection);
  });

  test('does not fetch immediately - buffers until flushed', async () => {
    const fetchMock = setUp();

    await recordGaugeWithExemplar({ name: 'http_server_duration_seconds', value: 0.1 });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('automatically flushes once the flush interval elapses', async () => {
    const fetchMock = setUp();

    await recordGaugeWithExemplar({ name: 'http_server_duration_seconds', value: 0.1 });
    await vi.advanceTimersByTimeAsync(2000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('flushes immediately once the buffer reaches its size threshold, without waiting for the timer', async () => {
    const fetchMock = setUp();

    await Promise.all(
      Array.from({ length: 20 }, async (_, index) => {
        await recordGaugeWithExemplar({ name: 'http_server_duration_seconds', value: index });
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('merges multiple data points recorded for the same metric name into one metric entry', async () => {
    const fetchMock = setUp();

    await recordGaugeWithExemplar({ name: 'http_server_duration_seconds', value: 0.1 });
    await recordGaugeWithExemplar({ name: 'http_server_duration_seconds', value: 0.2 });
    await flushExemplarMetrics();

    const { parsedBody } = parseLastRequestBody(fetchMock);
    const body = metricsBodySchema.parse(parsedBody);
    const [{ scopeMetrics }] = body.resourceMetrics;
    const [{ metrics }] = scopeMetrics;

    expect(metrics).toHaveLength(1);
    expect(metrics[0]?.sum.dataPoints).toHaveLength(2);
  });

  test('keeps data points for different metric names as separate metric entries', async () => {
    const fetchMock = setUp();

    await recordGaugeWithExemplar({ name: 'http_server_duration_seconds', value: 0.1 });
    await recordGaugeWithExemplar({ name: 'request_hits_total', value: 1 });
    await flushExemplarMetrics();

    const { parsedBody } = parseLastRequestBody(fetchMock);
    const body = metricsBodySchema.parse(parsedBody);
    const [{ scopeMetrics }] = body.resourceMetrics;
    const [{ metrics }] = scopeMetrics;

    expect(metrics.map((metric) => metric.name).toSorted()).toStrictEqual([
      'http_server_duration_seconds',
      'request_hits_total',
    ]);
  });

  test('logs an error instead of throwing when the flush request fails', async () => {
    getTelemetryConfigMock.mockReturnValue({
      environment: 'test',
      otlpEndpoint: 'http://otlp.example.com',
      serviceName: '@acme/api',
      serviceVersion: '1.0.0',
    });
    const fetchMock = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(new Error('network unreachable'));
    vi.stubGlobal('fetch', fetchMock);

    await recordGaugeWithExemplar({ name: 'http_server_duration_seconds', value: 0.1 });

    await expect(flushExemplarMetrics()).resolves.toBeUndefined();
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Failed to flush a batch of exemplar metrics',
      expect.any(Object),
    );
  });

  test('resolves without doing anything when there is nothing buffered to flush', async () => {
    setUp();

    await expect(flushExemplarMetrics()).resolves.toBeUndefined();
  });

  test('automatically attaches an exemplar for whichever span is active, without it being passed in', async () => {
    getTraceContextMock.mockReturnValue({ spanId: 'abc123', traceId: 'def456' });
    const fetchMock = setUp();

    await recordGaugeWithExemplar({
      attributes: { 'http.method': 'GET', 'http.status_code': 200, ok: true },
      description: 'test description',
      name: 'http_server_duration_seconds',
      unit: 's',
      value: 0.42,
    });
    await flushExemplarMetrics();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { parsedBody, requestInit, url } = parseLastRequestBody(fetchMock);

    expect(url).toBe('http://otlp.example.com/v1/metrics');
    expect(requestInit.method).toBe('POST');
    expect(requestInit.headers).toStrictEqual({ 'content-type': 'application/json' });

    expect(parsedBody).toStrictEqual({
      resourceMetrics: [
        {
          resource: {
            attributes: [
              { key: 'deployment.environment', value: { stringValue: 'test' } },
              { key: 'service.name', value: { stringValue: '@acme/api' } },
              { key: 'service.version', value: { stringValue: '1.0.0' } },
            ],
          },
          scopeMetrics: [
            {
              metrics: [
                {
                  description: 'test description',
                  name: 'http_server_duration_seconds',
                  sum: {
                    aggregationTemporality: 2,
                    dataPoints: [
                      {
                        asDouble: 0.42,
                        attributes: [
                          { key: 'http.method', value: { stringValue: 'GET' } },
                          { key: 'http.status_code', value: { doubleValue: 200 } },
                          { key: 'ok', value: { boolValue: true } },
                        ],
                        exemplars: [
                          {
                            asDouble: 0.42,
                            spanId: 'abc123',
                            timeUnixNano: '1704067200000000000',
                            traceId: 'def456',
                          },
                        ],
                        timeUnixNano: '1704067200000000000',
                      },
                    ],
                    isMonotonic: false,
                  },
                  unit: 's',
                },
              ],
              scope: { name: 'application' },
            },
          ],
        },
      ],
    });
  });

  test('sends no exemplar when there is no active span, but still records the metric value', async () => {
    const fetchMock = setUp();

    await recordGaugeWithExemplar({
      name: 'bare_metric',
      value: 1,
    });
    await flushExemplarMetrics();

    const { parsedBody } = parseLastRequestBody(fetchMock);

    expect(parsedBody).toStrictEqual({
      resourceMetrics: [
        {
          resource: {
            attributes: [
              { key: 'deployment.environment', value: { stringValue: 'test' } },
              { key: 'service.name', value: { stringValue: '@acme/api' } },
              { key: 'service.version', value: { stringValue: '1.0.0' } },
            ],
          },
          scopeMetrics: [
            {
              metrics: [
                {
                  name: 'bare_metric',
                  sum: {
                    aggregationTemporality: 2,
                    dataPoints: [
                      {
                        asDouble: 1,
                        attributes: [],
                        exemplars: [],
                        timeUnixNano: '1704067200000000000',
                      },
                    ],
                    isMonotonic: false,
                  },
                },
              ],
              scope: { name: 'application' },
            },
          ],
        },
      ],
    });
  });

  test('auto-attaches session.id to the exemplar filteredAttributes when a session is active', async () => {
    getTraceContextMock.mockReturnValue({ spanId: 'abc123', traceId: 'def456' });
    getSessionIdMock.mockReturnValue('auto-session-id');
    const fetchMock = setUp();

    await recordGaugeWithExemplar({ name: 'http_server_duration_seconds', value: 0.1 });
    await flushExemplarMetrics();

    const { parsedBody } = parseLastRequestBody(fetchMock);
    const dataPoint = getSingleDataPoint(parsedBody);

    expect(dataPoint).toMatchObject({
      exemplars: [
        {
          filteredAttributes: [{ key: 'session.id', value: { stringValue: 'auto-session-id' } }],
        },
      ],
    });
  });

  test('lets an explicit exemplarAttributes session.id win over the auto-attached one', async () => {
    getTraceContextMock.mockReturnValue({ spanId: 'abc123', traceId: 'def456' });
    getSessionIdMock.mockReturnValue('auto-session-id');
    const fetchMock = setUp();

    await recordGaugeWithExemplar({
      exemplarAttributes: { 'session.id': 'explicit-session-id' },
      name: 'http_server_duration_seconds',
      value: 0.1,
    });
    await flushExemplarMetrics();

    const { parsedBody } = parseLastRequestBody(fetchMock);
    const dataPoint = getSingleDataPoint(parsedBody);

    expect(dataPoint).toMatchObject({
      exemplars: [
        {
          filteredAttributes: [
            { key: 'session.id', value: { stringValue: 'explicit-session-id' } },
          ],
        },
      ],
    });
  });

  test('omits filteredAttributes entirely when there is no session and no exemplarAttributes', async () => {
    getTraceContextMock.mockReturnValue({ spanId: 'abc123', traceId: 'def456' });
    const fetchMock = setUp();

    await recordGaugeWithExemplar({ name: 'http_server_duration_seconds', value: 0.1 });
    await flushExemplarMetrics();

    const { parsedBody } = parseLastRequestBody(fetchMock);
    const dataPoint = getSingleDataPoint(parsedBody);

    expect(dataPoint).not.toHaveProperty('exemplars.0.filteredAttributes');
  });
});
