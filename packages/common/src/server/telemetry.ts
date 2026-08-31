import type { IncomingMessage, ServerResponse } from 'node:http';

import { DiagConsoleLogger, DiagLogLevel, diag, metrics, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import type { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import type { LoggerProvider } from '@opentelemetry/sdk-logs';
import type { MeterProvider } from '@opentelemetry/sdk-metrics';
import type { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import { getEnv } from '../environment';
import { logger } from '../logger';
import { tracer } from '../utils/telemetry';

interface TelemetryOptions {
  serviceName?: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
}

let initialized = false;
let prometheusExporterInstance: PrometheusExporter | undefined = undefined;
let shutdownFn: (() => Promise<void>) | undefined = undefined;
let tracerProviderInstance: WebTracerProvider | undefined = undefined;
let meterProviderInstance: MeterProvider | undefined = undefined;
let loggerProviderInstance: LoggerProvider | undefined = undefined;

const flushTelemetry = async () => {
  if (!initialized) {
    return;
  }
  try {
    await Promise.allSettled([
      tracerProviderInstance?.forceFlush(),
      meterProviderInstance?.forceFlush(),
      loggerProviderInstance?.forceFlush(),
    ]);
  } catch (error) {
    logger.error('Failed to flush telemetry', { error });
  }
};

const isIncomingMessage = (_obj: unknown): _obj is IncomingMessage => true;
const isServerResponse = (_obj: unknown): _obj is ServerResponse => true;

const prometheusExporter = {
  getMetricsRequestHandler: (req: IncomingMessage, res: ServerResponse) => {
    if (prometheusExporterInstance) {
      prometheusExporterInstance.getMetricsRequestHandler(req, res);
      return;
    }
    res.statusCode = 503;
    res.end('Metrics not initialized');
  },
  getMetricsResponse: async (): Promise<Response> => {
    if (!prometheusExporterInstance) {
      return new globalThis.Response('Metrics not initialized', { status: 503 });
    }

    const response = await new Promise<Response>((resolve) => {
      const mockRes: {
        end: (data: string) => void;
        headers: Record<string, string>;
        setHeader: (name: string, value: string) => void;
        statusCode: number;
      } = {
        end(data: string) {
          resolve(
            new globalThis.Response(data, {
              headers: mockRes.headers,
              status: mockRes.statusCode,
            }),
          );
        },
        headers: {},
        setHeader(name: string, value: string) {
          mockRes.headers[name] = value;
        },
        statusCode: 200,
      };

      const req: unknown = {
        headers: {},
        method: 'GET',
        url: '/metrics',
      };
      const res: unknown = mockRes;

      if (isIncomingMessage(req) && isServerResponse(res)) {
        prometheusExporterInstance?.getMetricsRequestHandler(req, res);
      }
    });

    return response;
  },
};

const initializeTelemetry = async (options: TelemetryOptions = {}) => {
  await Promise.resolve();

  if (initialized) {
    return;
  }
  initialized = true;

  const otlpEndpoint =
    options.otlpEndpoint ?? getEnv('OTEL_EXPORTER_OTLP_ENDPOINT') ?? 'http://localhost:4318';

  if (getEnv('TELEMETRY_DEBUG') === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const serviceName = options.serviceName ?? getEnv('SERVICE_NAME') ?? '@lightproject/app';
  const serviceVersion = options.serviceVersion ?? getEnv('SERVICE_VERSION') ?? '1.0.0';

  const { OTLPLogExporter } = await import('@opentelemetry/exporter-logs-otlp-http');
  const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-http');
  const { PrometheusExporter: DynPrometheusExporter } =
    await import('@opentelemetry/exporter-prometheus');
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
  const { resourceFromAttributes } = await import('@opentelemetry/resources');

  const { BatchLogRecordProcessor, LoggerProvider } = await import('@opentelemetry/sdk-logs');

  const { PeriodicExportingMetricReader, MeterProvider } =
    await import('@opentelemetry/sdk-metrics');

  const { WebTracerProvider, BatchSpanProcessor } = await import('@opentelemetry/sdk-trace-web');
  const { registerInstrumentations } = await import('@opentelemetry/instrumentation');

  const { FetchInstrumentation } = await import('@opentelemetry/instrumentation-fetch');

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
  });

  tracerProviderInstance = new WebTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: `${otlpEndpoint}/v1/traces`,
        }),
      ),
    ],
  });
  tracerProviderInstance.register();

  prometheusExporterInstance = new DynPrometheusExporter({ preventServerStart: true });

  meterProviderInstance = new MeterProvider({
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: `${otlpEndpoint}/v1/metrics`,
        }),
      }),
      prometheusExporterInstance,
    ],
    resource,
  });
  metrics.setGlobalMeterProvider(meterProviderInstance);

  loggerProviderInstance = new LoggerProvider({
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${otlpEndpoint}/v1/logs`,
        }),
      }),
    ],
    resource,
  });
  logs.setGlobalLoggerProvider(loggerProviderInstance);

  registerInstrumentations({
    instrumentations: [new FetchInstrumentation()],
  });

  shutdownFn = async () => {
    await Promise.all([
      tracerProviderInstance?.shutdown(),
      meterProviderInstance?.shutdown(),
      loggerProviderInstance?.shutdown(),
    ]);
  };

  const shutdown = async () => {
    try {
      await shutdownFn?.();
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
    if (globalThis.process.listenerCount(signal) === 0) {
      globalThis.process.once(signal, () => {
        shutdown().catch(() => {});
      });
    }
  }

  const span = tracer.startSpan('opentelemetry.initialize', {
    attributes: {
      initialized: true,
      'otel.endpoint': otlpEndpoint,
      'otel.service.name': serviceName,
      'otel.service.version': serviceVersion,
    },
    root: true,
  });

  span.end();

  logger.info('OpenTelemetry initialized', {
    otlpEndpoint,
    serviceName,
    serviceVersion,
  });
};

const resetTelemetryForTests = () => {
  trace.disable();
  metrics.disable();
  logs.disable();
  initialized = false;
};

export {
  flushTelemetry,
  initializeTelemetry,
  isIncomingMessage,
  isServerResponse,
  prometheusExporter,
  resetTelemetryForTests,
};
export type { TelemetryOptions };
