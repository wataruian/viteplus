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
    const startedAt = Date.now();
    const mark = (label: string) => {
      globalThis.console.error(`[telemetry-diag] ${label} at +${Date.now() - startedAt}ms`);
    };
    mark('test start');

    const collector = await startFakeOtelCollector();
    mark('collector started');
    const fetchTarget = await startFakeOtelCollector();
    mark('fetchTarget started');

    try {
      initializeRum({
        faroEndpoint: collector.url,
        otlpEndpoint: collector.url,
        serviceName: '@lightproject/frontend-test',
        serviceVersion: '1.2.3',
      });
      mark('initializeRum done');

      faro.api.pushLog([testLogMessage]);
      mark('pushLog done');

      getMeter().createCounter('button_clicks', { description: 'button_clicks' }).add(1);
      mark('counter.add done');
      await flushRum();
      mark('flushRum done');

      await globalThis.fetch(`${fetchTarget.url}/probe`).catch(() => {});
      mark('probe fetch done');

      const [logRequest, metricRequest, traceRequest] = await Promise.all([
        collector
          .waitForRequest(
            '/collect',
            (request) => collectLogBodySchema.safeParse(request.body).success,
          )
          .then((result) => {
            mark('log request received');
            return result;
          }),
        collector.waitForRequest('/v1/metrics').then((result) => {
          mark('metric request received');
          return result;
        }),
        collector
          .waitForRequest(
            '/collect',
            (request) => collectTraceBodySchema.safeParse(request.body).success,
          )
          .then((result) => {
            mark('trace request received');
            return result;
          }),
      ]);
      mark('Promise.all done');

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
