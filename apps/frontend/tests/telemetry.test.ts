import { startFakeOtelCollector } from '@lightproject/common/testing';
import { faro, flushRum, getMeter, initializeRum } from '@lightproject/common/utils';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { z } from 'zod';

const metricBodySchema = z.object({
  resourceMetrics: z.array(
    z.object({
      scopeMetrics: z.array(z.object({ metrics: z.array(z.object({ name: z.string() })) })),
    }),
  ),
});

const collectLogBodySchema = z.object({
  logs: z.array(z.object({ message: z.string() })),
});

const collectTraceBodySchema = z.object({
  traces: z.object({
    resourceSpans: z.array(
      z.object({
        scopeSpans: z.array(z.object({ spans: z.array(z.object({ name: z.string() })) })),
      }),
    ),
  }),
});

const testLogMessage = 'frontend telemetry integration test log';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('RUM telemetry', () => {
  test('pushes a log and a trace span to Faro, and a metric to the OTEL collector', async () => {
    const collector = await startFakeOtelCollector();
    const fetchTarget = await startFakeOtelCollector();

    try {
      initializeRum({
        faroEndpoint: collector.url,
        otlpEndpoint: collector.url,
        serviceName: '@lightproject/frontend-test',
        serviceVersion: '1.2.3',
      });

      faro.api.pushLog([testLogMessage]);

      getMeter().createCounter('button_clicks', { description: 'button_clicks' }).add(1);
      await flushRum();

      await globalThis.fetch(`${fetchTarget.url}/probe`).catch(() => {});

      const [logRequest, metricRequest, traceRequest] = await Promise.all([
        collector.waitForRequest(
          '/collect',
          (request) => collectLogBodySchema.safeParse(request.body).success,
        ),
        collector.waitForRequest('/v1/metrics'),
        collector.waitForRequest(
          '/collect',
          (request) => collectTraceBodySchema.safeParse(request.body).success,
        ),
      ]);

      const log = collectLogBodySchema.parse(logRequest.body);
      expect(log.logs.some((entry) => entry.message.includes(testLogMessage))).toBe(true);

      const metric = metricBodySchema.parse(metricRequest.body);
      const metricNames = metric.resourceMetrics.flatMap((resourceMetric) =>
        resourceMetric.scopeMetrics.flatMap((scopeMetric) =>
          scopeMetric.metrics.map((item) => item.name),
        ),
      );
      expect(metricNames).toContain('button_clicks');

      const trace = collectTraceBodySchema.parse(traceRequest.body);
      const spanNames = trace.traces.resourceSpans.flatMap((resourceSpan) =>
        resourceSpan.scopeSpans.flatMap((scopeSpan) => scopeSpan.spans.map((span) => span.name)),
      );
      expect(spanNames.length).toBeGreaterThan(0);

      expect(fetchTarget.requestsFor('/probe')).toHaveLength(1);
    } finally {
      await Promise.all([collector.close(), fetchTarget.close()]);
    }
  });
});
