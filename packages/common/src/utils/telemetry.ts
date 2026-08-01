import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getEnv } from '../environment';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { logger } from '../logger';
import { resourceFromAttributes } from '@opentelemetry/resources';

interface TelemetryOptions {
  metricsEndpoint?: string;
  serviceName?: string;
  serviceVersion?: string;
  traceEndpoint?: string;
}

let sdk: NodeSDK | undefined = undefined;
let shutdownHandlerRegistered = false;

const initializeTelemetry = (options: TelemetryOptions = {}) => {
  if (sdk) {
    return sdk;
  }

  const metricsEndpoint =
    options.metricsEndpoint ?? getEnv('METRICS_ENDPOINT') ?? 'http://localhost:4318/v1/metrics';
  const traceEndpoint =
    options.traceEndpoint ?? getEnv('TRACE_ENDPOINT') ?? 'http://localhost:4318/v1/traces';

  if (getEnv('TELEMETRY_DEBUG') === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  sdk = new NodeSDK({
    instrumentations: [getNodeAutoInstrumentations()],

    metricReader: new PeriodicExportingMetricReader({
      exportIntervalMillis: 10_000,
      exporter: new OTLPMetricExporter({
        url: metricsEndpoint,
      }),
    }),

    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName ?? getEnv('SERVICE_NAME') ?? '@lightproject/app',
      [ATTR_SERVICE_VERSION]: options.serviceVersion ?? getEnv('SERVICE_VERSION') ?? '1.0.0',
    }),

    traceExporter: new OTLPTraceExporter({
      url: traceEndpoint,
    }),
  });

  sdk.start();

  if (!shutdownHandlerRegistered) {
    globalThis.process.on('SIGTERM', () => {
      (async () => {
        try {
          await sdk?.shutdown();
        } catch (error) {
          logger.error('Failed to shut down OpenTelemetry SDK', { error });
        } finally {
          globalThis.process.exit(0);
        }
      })().catch(() => {
        // Unreachable because the async IIFE already catches errors,
      });
    });

    shutdownHandlerRegistered = true;
  }

  logger.info('OpenTelemetry initialized');

  return sdk;
};

export type { TelemetryOptions };
export { initializeTelemetry };
