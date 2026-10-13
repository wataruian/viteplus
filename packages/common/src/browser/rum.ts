import {
  type Faro,
  LogLevel as FaroLogLevel,
  faro,
  getWebInstrumentations,
  initializeFaro,
} from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporalityPreference,
  OTLPMetricExporter,
} from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

import { apiBaseUrl } from '../configs';
import { getEnv, isBrowser } from '../environment';
import { type BrowserLogSink, type LogLevel, registerBrowserLogSink } from '../logger';
import { flushExemplarMetrics } from '../utils/exemplar-metrics';
import { getServiceInstanceId, setTelemetryConfig } from '../utils/telemetry';
import { escapeRegExp } from '../utils/text';

interface RumOptions {
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;
  faroEndpoint?: string;
  otlpEndpoint?: string;
  apiUrl?: string;
}

const faroLogLevel: Record<LogLevel, FaroLogLevel> = {
  debug: FaroLogLevel.DEBUG,
  error: FaroLogLevel.ERROR,
  info: FaroLogLevel.INFO,
  warn: FaroLogLevel.WARN,
};

type FaroLogSinkApi = Pick<Faro['api'], 'pushLog'>;

const createFaroLogSink = (instance: { api: FaroLogSinkApi }): BrowserLogSink => ({
  pushLog: (entry) => {
    instance.api.pushLog([JSON.stringify(entry)], {
      level: faroLogLevel[entry.level],
      ...(entry.traceId === undefined || entry.spanId === undefined
        ? {}
        : { spanContext: { spanId: entry.spanId, traceId: entry.traceId } }),
    });
  },
});

let isInitialized = false;
let meterProviderInstance: MeterProvider | undefined = undefined;

const flushRum = async () => {
  await Promise.allSettled([meterProviderInstance?.forceFlush(), flushExemplarMetrics()]);
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

  const serviceName =
    options.serviceName ??
    getEnv('SERVICE_NAME') ??
    getEnv('VITE_SERVICE_NAME') ??
    '@lightproject/app';

  const serviceVersion =
    options.serviceVersion ??
    getEnv('SERVICE_VERSION') ??
    getEnv('VITE_SERVICE_VERSION') ??
    '1.0.0';

  const environment = options.environment ?? getEnv('ENV') ?? getEnv('VITE_ENV') ?? 'local';

  const faroEndpoint =
    options.faroEndpoint ??
    getEnv('FARO_ENDPOINT') ??
    getEnv('VITE_FARO_ENDPOINT') ??
    'http://localhost:12347';

  const otlpEndpoint =
    options.otlpEndpoint ??
    getEnv('OTEL_EXPORTER_OTLP_ENDPOINT') ??
    getEnv('VITE_OTEL_EXPORTER_OTLP_ENDPOINT') ??
    'http://localhost:4318';

  const apiUrl = options.apiUrl ?? apiBaseUrl;

  setTelemetryConfig({ environment, otlpEndpoint, serviceName, serviceVersion });

  meterProviderInstance = new MeterProvider({
    readers: [
      new PeriodicExportingMetricReader({
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
    instrumentations: [
      ...getWebInstrumentations({
        captureConsole: true,
      }),
      new TracingInstrumentation({
        instrumentationOptions: {
          propagateTraceHeaderCorsUrls: [new RegExp(`^${escapeRegExp(apiUrl)}`, 'u')],
        },
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
  initializeRum,
  registerLifecycleFlush,
};
export type { FaroLogSinkApi, RumOptions };
