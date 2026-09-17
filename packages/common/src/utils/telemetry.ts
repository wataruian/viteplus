import { type Span, context, metrics, trace } from '@opentelemetry/api';

import { getEnv } from '../environment';

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

const tracer = trace.getTracer(getEnv('OTEL_SERVICE_NAME') ?? 'application');
const getMeter = () => metrics.getMeter(getEnv('OTEL_SERVICE_NAME') ?? 'application');

const runWithSpan = <R>(span: Span, fn: () => R): R =>
  context.with(trace.setSpan(context.active(), span), fn);

export { context, metrics, propagation, trace, type Counter, type Span } from '@opentelemetry/api';
export { getMeter, getTelemetryConfig, runWithSpan, setTelemetryConfig, tracer };
export type { ResolvedTelemetryConfig };
