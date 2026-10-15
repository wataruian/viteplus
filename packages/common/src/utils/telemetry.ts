import { type Span, context, metrics, trace } from '@opentelemetry/api';

import { getEnv } from '../environment';
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

let serviceInstanceId: string | undefined = undefined;

const getServiceInstanceId = (): string => {
  serviceInstanceId ??= generateShortUuid();
  return serviceInstanceId;
};

const tracer = trace.getTracer(getEnv('OTEL_SERVICE_NAME') ?? 'application');
const getMeter = () => metrics.getMeter(getEnv('OTEL_SERVICE_NAME') ?? 'application');

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
  getMeter,
  getServiceInstanceId,
  getTelemetryConfig,
  runWithSpan,
  setTelemetryConfig,
  tracer,
};
export type { ResolvedTelemetryConfig };
