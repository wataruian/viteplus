import { resetTelemetryForTests } from '@lightproject/common/server';
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { z } from 'zod';

import packageJson from '../package.json' with { type: 'json' };
import { startFakeOtelCollector } from './helpers/otel-collector';
import { runtimes } from './helpers/utils';

const attributeValueSchema = z.object({ stringValue: z.string().optional() });
const attributeSchema = z.object({ key: z.string(), value: attributeValueSchema });
const resourceSchema = z.object({ attributes: z.array(attributeSchema) });

const traceBodySchema = z.object({
  resourceSpans: z.array(
    z.object({
      resource: resourceSchema,
      scopeSpans: z.array(z.object({ spans: z.array(z.object({ name: z.string() })) })),
    }),
  ),
});

const logBodySchema = z.object({
  resourceLogs: z.array(
    z.object({
      resource: resourceSchema,
      scopeLogs: z.array(
        z.object({
          logRecords: z.array(z.object({ body: z.object({ stringValue: z.string() }) })),
        }),
      ),
    }),
  ),
});

const metricBodySchema = z.object({
  resourceMetrics: z.array(
    z.object({
      resource: resourceSchema,
      scopeMetrics: z.array(z.object({ metrics: z.array(z.object({ name: z.string() })) })),
    }),
  ),
});

const findAttribute = (attributes: z.infer<typeof attributeSchema>[], key: string) =>
  attributes.find((attribute) => attribute.key === key)?.value.stringValue;

beforeEach(() => {
  resetTelemetryForTests();
  vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  resetTelemetryForTests();
});

describe.each(runtimes)('on $name', ({ cleanup, importApp }) => {
  afterAll(cleanup);

  test('a request pushes a log, a trace span, and a metric to the OTEL collector', async () => {
    const collector = await startFakeOtelCollector();
    const otherCollector = await startFakeOtelCollector();

    try {
      const app = await importApp({
        LOG_LEVEL: 'info',
        OTEL_EXPORTER_OTLP_ENDPOINT: collector.url,
      });
      const res = await app.request('/');
      expect(res.status).toBe(200);

      const [traceRequest, logRequest, metricRequest] = await Promise.all([
        collector.waitForRequest('/v1/traces'),
        collector.waitForRequest('/v1/logs'),
        collector.waitForRequest('/v1/metrics'),
      ]);

      const trace = traceBodySchema.parse(traceRequest.body);
      expect(trace.resourceSpans.length).toBeGreaterThan(0);
      const [traceResourceSpans] = trace.resourceSpans;
      expect(findAttribute(traceResourceSpans.resource.attributes, 'service.name')).toBe(
        packageJson.name,
      );
      const spanNames = trace.resourceSpans.flatMap((resourceSpan) =>
        resourceSpan.scopeSpans.flatMap((scopeSpan) => scopeSpan.spans.map((span) => span.name)),
      );
      expect(spanNames).toContain('http.request:GET');

      const log = logBodySchema.parse(logRequest.body);
      const logMessages = log.resourceLogs.flatMap((resourceLog) =>
        resourceLog.scopeLogs.flatMap((scopeLog) =>
          scopeLog.logRecords.map((logRecord) => logRecord.body.stringValue),
        ),
      );
      expect(logMessages.some((message) => message.includes('Incoming Request'))).toBe(true);

      const metric = metricBodySchema.parse(metricRequest.body);
      const metricNames = metric.resourceMetrics.flatMap((resourceMetric) =>
        resourceMetric.scopeMetrics.flatMap((scopeMetric) =>
          scopeMetric.metrics.map((item) => item.name),
        ),
      );
      expect(metricNames).toContain('request_hits');

      expect(otherCollector.requestsFor('/v1/traces')).toHaveLength(0);
      expect(otherCollector.requestsFor('/v1/logs')).toHaveLength(0);
      expect(otherCollector.requestsFor('/v1/metrics')).toHaveLength(0);
    } finally {
      await Promise.all([collector.close(), otherCollector.close()]);
    }
  });
});
