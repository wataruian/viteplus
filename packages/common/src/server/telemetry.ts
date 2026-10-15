import {
  DiagConsoleLogger,
  DiagLogLevel,
  context,
  diag,
  metrics,
  propagation,
  trace,
} from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import {
  AggregationTemporalityPreference,
  OTLPMetricExporter,
} from '@opentelemetry/exporter-metrics-otlp-http';
import { PrometheusSerializer } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import {
  MeterProvider,
  MetricReader,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import {
  BatchSpanProcessor,
  StackContextManager,
  WebTracerProvider,
} from '@opentelemetry/sdk-trace-web';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

import { getEnv } from '../environment';
import { logger } from '../logger';
import { flushExemplarMetrics } from '../utils/exemplar-metrics';
import {
  METRIC_EXPORT_INTERVAL_MS,
  getServiceInstanceId,
  setTelemetryConfig,
  tracer,
} from '../utils/telemetry';
import { escapeRegExp } from '../utils/text';
import { requestContextSpanProcessor } from './request-context-span-processor';

interface TelemetryOptions {
  serviceName?: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
  environment?: string;
}

class PullMetricReader extends MetricReader {
  private stopped = false;

  public get isStopped(): boolean {
    return this.stopped;
  }

  protected override async onForceFlush(): Promise<void> {
    await Promise.resolve();

    if (this.stopped) {
      logger.debug('PullMetricReader force-flushed after being stopped');
    }
  }

  protected override async onShutdown(): Promise<void> {
    this.stopped = true;
    await Promise.resolve();
  }
}

const prometheusSerializer = new PrometheusSerializer();

let initialized = false;
let pullMetricReaderInstance: PullMetricReader | undefined = undefined;
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
      flushExemplarMetrics(),
    ]);
  } catch (error) {
    logger.error('Failed to flush telemetry', { error });
  }
};

const prometheusExporter = {
  getMetricsResponse: async (): Promise<Response> => {
    if (!pullMetricReaderInstance || pullMetricReaderInstance.isStopped) {
      return new globalThis.Response('Metrics not initialized', {
        status: 503,
      });
    }

    const { resourceMetrics } = await pullMetricReaderInstance.collect();
    const body = prometheusSerializer.serialize(resourceMetrics);

    return new globalThis.Response(body, {
      headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' },
    });
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
  const environment = options.environment ?? getEnv('ENV') ?? 'local';

  setTelemetryConfig({ environment, otlpEndpoint, serviceName, serviceVersion });

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: environment,
    'deployment.environment': environment,
    'service.instance.id': getServiceInstanceId(),
  });

  tracerProviderInstance = new WebTracerProvider({
    resource,
    spanProcessors: [
      requestContextSpanProcessor,
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: `${otlpEndpoint}/v1/traces`,
        }),
      ),
    ],
  });
  tracerProviderInstance.register();

  pullMetricReaderInstance = new PullMetricReader();

  meterProviderInstance = new MeterProvider({
    readers: [
      new PeriodicExportingMetricReader({
        exportIntervalMillis: METRIC_EXPORT_INTERVAL_MS,
        exportTimeoutMillis: METRIC_EXPORT_INTERVAL_MS,
        exporter: new OTLPMetricExporter({
          temporalityPreference: AggregationTemporalityPreference.DELTA,
          url: `${otlpEndpoint}/v1/metrics`,
        }),
      }),
      pullMetricReaderInstance,
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
    instrumentations: [
      new FetchInstrumentation({ ignoreUrls: [new RegExp(`^${escapeRegExp(otlpEndpoint)}`, 'u')] }),
    ],
  });

  shutdownFn = async () => {
    await Promise.all([
      flushExemplarMetrics(),
      tracerProviderInstance?.shutdown(),
      meterProviderInstance?.shutdown(),
      loggerProviderInstance?.shutdown(),
    ]);
  };

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
    environment,
    otlpEndpoint,
    serviceName,
    serviceVersion,
  });
};

const shutdownTelemetry = async () => {
  if (!initialized) {
    return;
  }
  try {
    await shutdownFn?.();
  } catch (error) {
    logger.error('Failed to shutdown OpenTelemetry', {
      error,
    });
  }
};

const initializeContextPropagation = () => {
  context.setGlobalContextManager(new StackContextManager().enable());
};

const resetTelemetryForTests = () => {
  context.disable();
  trace.disable();
  metrics.disable();
  logs.disable();
  propagation.disable();
  initialized = false;
  setTelemetryConfig(undefined);
};

export {
  PullMetricReader,
  flushTelemetry,
  initializeContextPropagation,
  initializeTelemetry,
  prometheusExporter,
  prometheusSerializer,
  resetTelemetryForTests,
  shutdownTelemetry,
};
export type { TelemetryOptions };
