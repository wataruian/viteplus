import { metrics, trace } from '@opentelemetry/api';

import { getEnv } from '../environment';

const tracer = trace.getTracer(getEnv('OTEL_SERVICE_NAME') ?? 'application');
const getMeter = () => metrics.getMeter(getEnv('OTEL_SERVICE_NAME') ?? 'application');

export { context, metrics, trace, type Counter } from '@opentelemetry/api';
export { getMeter, tracer };
