import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { DiagConsoleLogger, DiagLogLevel, diag, trace } from '@opentelemetry/api';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getEnv } from '../environment';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { logger } from '../logger';
import { resourceFromAttributes } from '@opentelemetry/resources';

interface TelemetryOptions {
  serviceName?: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
}

let sdk: NodeSDK | undefined = undefined;
let shutdownRegistered = false;
const tracer = trace.getTracer('application');

const initializeTelemetry = async (options: TelemetryOptions = {}) => {
  if (sdk) {
    return sdk;
  }

  const endpoint =
    options.otlpEndpoint ?? getEnv('OTEL_EXPORTER_OTLP_ENDPOINT') ?? 'http://localhost:4318';

  if (getEnv('TELEMETRY_DEBUG') === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  sdk = new NodeSDK({
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
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
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${endpoint}/v1/metrics`,
      }),
    }),
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName ?? getEnv('SERVICE_NAME') ?? '@lightproject/app',
      [ATTR_SERVICE_VERSION]: options.serviceVersion ?? getEnv('SERVICE_VERSION') ?? '1.0.0',
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

    globalThis.process.once('SIGTERM', () => {
      shutdown().catch(() => {});
    });

    globalThis.process.once('SIGINT', () => {
      shutdown().catch(() => {});
    });

    shutdownRegistered = true;
  }

  await new Promise((resolve) => {
    const span = tracer.startSpan('opentelemetry.initialize');
    span.setAttribute('initialized', true).end();
    logger.info('OpenTelemetry initialized', {
      endpoint,
    });
    resolve(null);
  });

  return sdk;
};

export type { TelemetryOptions };
export { initializeTelemetry, tracer };
