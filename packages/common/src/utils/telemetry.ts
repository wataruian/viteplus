import { type Span, context, metrics, trace } from '@opentelemetry/api';

import { getOtelServiceName } from '../environment/variables';
import { generateShortUuid } from './text';

interface ResolvedTelemetryConfig {
  environment: string;
  otlpEndpoint: string;
  serviceName: string;
  serviceVersion: string;
}

let resolvedTelemetryConfig: ResolvedTelemetryConfig | undefined = undefined;

const getTelemetryConfig = (): ResolvedTelemetryConfig | undefined => resolvedTelemetryConfig;

const setTelemetryConfig = (config: ResolvedTelemetryConfig | undefined): void => {
  resolvedTelemetryConfig = config;
};

const METRIC_EXPORT_INTERVAL_MS = 5000;

let serviceInstanceId: string | undefined = undefined;

const getServiceInstanceId = (): string => {
  serviceInstanceId ??= generateShortUuid();
  return serviceInstanceId;
};

const tracer = trace.getTracer(getOtelServiceName());
const getMeter = () => metrics.getMeter(getOtelServiceName());

const runWithSpan = <R>(span: Span, fn: () => R): R =>
  context.with(trace.setSpan(context.active(), span), fn);

export {
  SpanStatusCode,
  context,
  metrics,
  propagation,
  trace,
  type Counter,
  type Span,
  type SpanStatus,
} from '@opentelemetry/api';

export {
  METRIC_EXPORT_INTERVAL_MS,
  getMeter,
  getServiceInstanceId,
  getTelemetryConfig,
  runWithSpan,
  setTelemetryConfig,
  tracer,
};
export type { ResolvedTelemetryConfig };
