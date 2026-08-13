import { faro, getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { metrics } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import { getEnv } from '../environment';

interface RumOptions {
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;
  endpoint?: string;
}

let isInitialized = false;

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

  const endpoint =
    options.endpoint ??
    getEnv('FARO_ENDPOINT') ??
    getEnv('VITE_FARO_ENDPOINT') ??
    'http://localhost:12347/collect';

  const otlpEndpoint =
    getEnv('OTLP_ENDPOINT') ?? getEnv('VITE_OTLP_ENDPOINT') ?? 'http://localhost:4318/v1/metrics';

  const meterProvider = new MeterProvider({
    readers: [
      new PeriodicExportingMetricReader({
        exportIntervalMillis: 5000,
        exporter: new OTLPMetricExporter({
          url: otlpEndpoint,
        }),
      }),
    ],
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
    }),
  });

  metrics.setGlobalMeterProvider(meterProvider);

  return initializeFaro({
    app: {
      environment,
      name: serviceName,
      version: serviceVersion,
    },
    instrumentations: [
      ...getWebInstrumentations({
        captureConsole: true,
      }),
      new TracingInstrumentation(),
    ],
    url: endpoint,
  });
};

export { faro } from '@grafana/faro-web-sdk';
export { initializeRum };
export type { RumOptions };
