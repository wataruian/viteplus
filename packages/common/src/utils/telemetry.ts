import { DiagConsoleLogger, DiagLogLevel, diag, trace } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import { getEnv } from '../environment';
import { logger } from '../logger';

interface TelemetryOptions {
  serviceName?: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
}

let sdk: NodeSDK | undefined = undefined;
let shutdownRegistered = false;
const tracer = trace.getTracer(getEnv('OTEL_SERVICE_NAME') ?? 'application');

const initializeTelemetry = async (options: TelemetryOptions = {}) => {
  await Promise.resolve();

  if (sdk) {
    return sdk;
  }

  const span = tracer.startSpan('opentelemetry.initialize');

  const endpoint =
    options.otlpEndpoint ?? getEnv('OTEL_EXPORTER_OTLP_ENDPOINT') ?? 'http://localhost:4318';

  if (getEnv('TELEMETRY_DEBUG') === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const serviceName = options.serviceName ?? getEnv('SERVICE_NAME') ?? '@lightproject/app';
  const serviceVersion = options.serviceVersion ?? getEnv('SERVICE_VERSION') ?? '1.0.0';

  sdk = new NodeSDK({
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

  span.setAttributes({
    initialized: true,
    'otel.endpoint': endpoint,
    'otel.service.name': serviceName,
    'otel.service.version': serviceVersion,
  });
  span.end();

  logger.info('OpenTelemetry initialized', {
    endpoint,
    serviceName,
    serviceVersion,
  });

  return sdk;
};

export { context, trace } from '@opentelemetry/api';
export { initializeTelemetry, tracer };
export type { TelemetryOptions };
