import {
  type Faro,
  LogLevel as FaroLogLevel,
  faro,
  getWebInstrumentations,
  initializeFaro,
} from '@grafana/faro-web-sdk';
import {
  FaroMetaAttributesSpanProcessor,
  FaroTraceExporter,
  TracingInstrumentation,
} from '@grafana/faro-web-tracing';
import { type Span, metrics } from '@opentelemetry/api';
import {
  AggregationTemporalityPreference,
  OTLPMetricExporter,
} from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor, type SpanProcessor } from '@opentelemetry/sdk-trace-web';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

import {
  getDeploymentEnvironment,
  getFaroEndpoint,
  getOtlpEndpoint,
  getServiceName,
  getServiceVersion,
  isBrowser,
} from '../environment';
import {
  type BrowserLogSink,
  type LogEntry,
  type LogLevel,
  getClientId,
  registerBrowserLogSink,
} from '../logger';
import { flushExemplarMetrics } from '../utils/exemplar-metrics';
import {
  METRIC_EXPORT_INTERVAL_MS,
  getServiceInstanceId,
  setTelemetryConfig,
} from '../utils/telemetry';
import { escapeRegExp } from '../utils/text';

interface RumOptions {
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;
  faroEndpoint?: string;
  otlpEndpoint?: string;
  propagateTraceHeaderUrls?: string[];
}

const faroLogLevel: Record<LogLevel, FaroLogLevel> = {
  debug: FaroLogLevel.DEBUG,
  error: FaroLogLevel.ERROR,
  info: FaroLogLevel.INFO,
  warn: FaroLogLevel.WARN,
};

type FaroLogSinkApi = Pick<Faro['api'], 'pushLog'>;

const toFaroLogContext = (entry: LogEntry): Record<string, string> => ({
  ...(entry.requestId === undefined ? {} : { requestId: entry.requestId }),
  ...(entry.clientId === undefined ? {} : { clientId: entry.clientId }),
});

const createFaroLogSink = (instance: { api: FaroLogSinkApi }): BrowserLogSink => ({
  pushLog: (entry) => {
    const context = toFaroLogContext(entry);
    instance.api.pushLog([JSON.stringify(entry)], {
      ...(Object.keys(context).length > 0 ? { context } : {}),
      level: faroLogLevel[entry.level],
      ...(entry.traceId === undefined || entry.spanId === undefined
        ? {}
        : { spanContext: { spanId: entry.spanId, traceId: entry.traceId } }),
    });
  },
});

const tagSpanWithIds = (span: Span, requestId: string | undefined): void => {
  const clientId = getClientId();
  if (requestId !== undefined) {
    span.setAttribute('request.id', requestId);
  }
  if (clientId !== undefined) {
    span.setAttribute('client.id', clientId);
  }
};

const tagXhrSpan = (span: Span): void => {
  tagSpanWithIds(span, undefined);
};

let isInitialized = false;
let meterProviderInstance: MeterProvider | undefined = undefined;

let faroSpanProcessor: SpanProcessor | undefined = undefined;

const getFaroSpanProcessor = (): SpanProcessor => {
  faroSpanProcessor ??= new FaroMetaAttributesSpanProcessor(
    new BatchSpanProcessor(new FaroTraceExporter({ api: faro.api }), {
      maxExportBatchSize: 30,
      scheduledDelayMillis: TracingInstrumentation.SCHEDULED_BATCH_DELAY_MS,
    }),
    faro.metas,
  );
  return faroSpanProcessor;
};

const flushableSpanProcessor: SpanProcessor = {
  forceFlush: async () => {
    await faroSpanProcessor?.forceFlush();
  },
  onEnd: (span) => {
    getFaroSpanProcessor().onEnd(span);
  },
  onStart: (span, parentContext) => {
    getFaroSpanProcessor().onStart(span, parentContext);
  },
  shutdown: async () => {
    await faroSpanProcessor?.shutdown();
  },
};

const flushRum = async () => {
  await Promise.allSettled([
    flushableSpanProcessor.forceFlush(),
    meterProviderInstance?.forceFlush(),
    flushExemplarMetrics(),
  ]);
};

const flushOnHide = () => {
  if (globalThis.document.visibilityState === 'hidden') {
    flushRum().catch(() => {});
  }
};

const registerLifecycleFlush = () => {
  if (!isBrowser()) {
    return;
  }

  globalThis.document.addEventListener('visibilitychange', flushOnHide);
  globalThis.addEventListener('pagehide', flushOnHide);
};

const initializeRum = (options: RumOptions = {}) => {
  if (isInitialized) {
    return faro;
  }

  isInitialized = true;

  const serviceName = options.serviceName ?? getServiceName();
  const serviceVersion = options.serviceVersion ?? getServiceVersion();
  const environment = options.environment ?? getDeploymentEnvironment();
  const faroEndpoint = options.faroEndpoint ?? getFaroEndpoint();
  const otlpEndpoint = options.otlpEndpoint ?? getOtlpEndpoint();

  setTelemetryConfig({ environment, otlpEndpoint, serviceName, serviceVersion });

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
    ],
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: environment,
      'deployment.environment': environment,
      'service.instance.id': getServiceInstanceId(),
    }),
  });

  metrics.setGlobalMeterProvider(meterProviderInstance);

  registerLifecycleFlush();

  const instance = initializeFaro({
    app: {
      environment,
      name: serviceName,
      version: serviceVersion,
    },
    ignoreUrls: [new RegExp(`^${escapeRegExp(otlpEndpoint)}`, 'u')],
    instrumentations: [
      ...getWebInstrumentations({
        captureConsole: true,
      }),
      new TracingInstrumentation({
        instrumentationOptions: {
          fetchInstrumentationOptions: {
            applyCustomAttributesOnSpan: (span, request) => {
              const requestId = new globalThis.Headers(request.headers).get('X-Request-Id');
              tagSpanWithIds(span, requestId ?? undefined);
            },
          },
          propagateTraceHeaderCorsUrls: (options.propagateTraceHeaderUrls ?? []).map(
            (url) => new RegExp(`^${escapeRegExp(url)}`, 'u'),
          ),
          xhrInstrumentationOptions: { applyCustomAttributesOnSpan: tagXhrSpan },
        },
        spanProcessor: flushableSpanProcessor,
      }),
    ],
    url: `${faroEndpoint}/collect`,
  });

  registerBrowserLogSink(createFaroLogSink(instance));

  return instance;
};

export { faro } from '@grafana/faro-web-sdk';
export {
  createFaroLogSink,
  faroLogLevel,
  flushOnHide,
  flushRum,
  flushableSpanProcessor,
  getFaroSpanProcessor,
  initializeRum,
  registerLifecycleFlush,
  tagSpanWithIds,
  tagXhrSpan,
  toFaroLogContext,
};
export type { FaroLogSinkApi, RumOptions };
