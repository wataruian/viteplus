import type { IncomingMessage, ServerResponse } from 'node:http';

import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import type { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import type { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import { getEnv } from '../environment';
import { logger } from '../logger';
import { tracer } from '../utils/telemetry';

interface TelemetryOptions {
  serviceName?: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
}

let sdk: NodeSDK | undefined = undefined;
let shutdownRegistered = false;
let prometheusExporterInstance: PrometheusExporter | undefined = undefined;

const prometheusExporter = {
  getMetricsRequestHandler: (req: IncomingMessage, res: ServerResponse) => {
    if (prometheusExporterInstance) {
      prometheusExporterInstance.getMetricsRequestHandler(req, res);
      return;
    }
    res.statusCode = 503;
    res.end('Metrics not initialized');
  },
};

const initializeTelemetry = async (options: TelemetryOptions = {}) => {
  await Promise.resolve();

  if (sdk) {
    return sdk;
  }

  const endpoint =
    options.otlpEndpoint ?? getEnv('OTEL_EXPORTER_OTLP_ENDPOINT') ?? 'http://localhost:4318';

  if (getEnv('TELEMETRY_DEBUG') === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const serviceName = options.serviceName ?? getEnv('SERVICE_NAME') ?? '@lightproject/app';
  const serviceVersion = options.serviceVersion ?? getEnv('SERVICE_VERSION') ?? '1.0.0';

  const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
  const { OTLPLogExporter } = await import('@opentelemetry/exporter-logs-otlp-http');
  const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-http');
  const { PrometheusExporter: DynPrometheusExporter } =
    await import('@opentelemetry/exporter-prometheus');
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
  const { resourceFromAttributes } = await import('@opentelemetry/resources');
  const { BatchLogRecordProcessor } = await import('@opentelemetry/sdk-logs');
  const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics');
  const { NodeSDK: DynNodeSDK } = await import('@opentelemetry/sdk-node');

  prometheusExporterInstance = new DynPrometheusExporter({ preventServerStart: true });

  sdk = new DynNodeSDK({
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-express': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-http': {
          enabled: false,
        },
      }),
    ],
    logRecordProcessors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${endpoint}/v1/logs`,
        }),
      }),
    ],
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: `${endpoint}/v1/metrics`,
        }),
      }),
      prometheusExporterInstance,
    ],
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
    }),
  });

  sdk.start();

  if (!shutdownRegistered) {
    const shutdown = async () => {
      try {
        await sdk?.shutdown();
      } catch (error) {
        logger.error('Failed to shutdown OpenTelemetry', {
          error,
        });
      } finally {
        globalThis.process.exit(0);
      }
    };

    const signals = ['SIGTERM', 'SIGINT', 'SIGHUP'];

    for (const signal of signals) {
      globalThis.process.once(signal, () => {
        shutdown().catch(() => {});
      });
    }

    shutdownRegistered = true;
  }

  const span = tracer.startSpan('opentelemetry.initialize', {
    attributes: {
      initialized: true,
      'otel.endpoint': endpoint,
      'otel.service.name': serviceName,
      'otel.service.version': serviceVersion,
    },
    root: true,
  });

  span.end();

  logger.info('OpenTelemetry initialized', {
    endpoint,
    serviceName,
    serviceVersion,
  });

  return sdk;
};

export { initializeTelemetry, prometheusExporter };
export type { TelemetryOptions };
