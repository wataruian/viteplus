import { logger } from '../logger';
import { getSessionId, getTraceContext } from '../logger/context';
import { getTelemetryConfig } from '../utils/telemetry';

type AttributeValue = boolean | number | string;

interface OtlpAttributeValue {
  boolValue?: boolean;
  doubleValue?: number;
  stringValue?: string;
}

interface OtlpKeyValue {
  key: string;
  value: OtlpAttributeValue;
}

interface OtlpExemplar {
  asDouble: number;
  filteredAttributes?: OtlpKeyValue[];
  spanId: string;
  timeUnixNano: string;
  traceId: string;
}

interface OtlpNumberDataPoint {
  asDouble: number;
  attributes: OtlpKeyValue[];
  exemplars: OtlpExemplar[];
  timeUnixNano: string;
}

interface OtlpMetric {
  description?: string;
  name: string;
  sum: {
    aggregationTemporality: 2;
    dataPoints: OtlpNumberDataPoint[];
    isMonotonic: false;
  };
  unit?: string;
}

interface OtlpMetricsExportRequest {
  resourceMetrics: {
    resource: { attributes: OtlpKeyValue[] };
    scopeMetrics: {
      metrics: OtlpMetric[];
      scope: { name: string };
    }[];
  }[];
}

interface GaugeExemplarOptions {
  attributes?: Record<string, AttributeValue>;
  description?: string;
  exemplarAttributes?: Record<string, AttributeValue>;
  name: string;
  unit?: string;
  value: number;
}

interface BufferedMetric {
  description?: string;
  dataPoints: OtlpNumberDataPoint[];
  name: string;
  unit?: string;
}

const FLUSH_INTERVAL_MS = 2000;
const MAX_BUFFERED_DATA_POINTS = 20;

const metricBuffer = new Map<string, BufferedMetric>();
let flushTimer: ReturnType<typeof globalThis.setTimeout> | undefined = undefined;

const toOtlpAttributeValue = (value: AttributeValue): OtlpAttributeValue => {
  if (typeof value === 'boolean') {
    return { boolValue: value };
  }
  if (typeof value === 'number') {
    return { doubleValue: value };
  }
  return { stringValue: value };
};

const toOtlpAttributes = (attributes: Record<string, AttributeValue>): OtlpKeyValue[] =>
  Object.entries(attributes).map(([key, value]) => ({ key, value: toOtlpAttributeValue(value) }));

const countBufferedDataPoints = (): number =>
  [...metricBuffer.values()].reduce((total, metric) => total + metric.dataPoints.length, 0);

const toOtlpMetric = (metric: BufferedMetric): OtlpMetric => {
  const otlpMetric: OtlpMetric = {
    name: metric.name,
    sum: {
      aggregationTemporality: 2,
      dataPoints: metric.dataPoints,
      isMonotonic: false,
    },
  };
  if (metric.description !== undefined) {
    otlpMetric.description = metric.description;
  }
  if (metric.unit !== undefined) {
    otlpMetric.unit = metric.unit;
  }
  return otlpMetric;
};

const flushExemplarMetrics = async (): Promise<void> => {
  if (flushTimer !== undefined) {
    globalThis.clearTimeout(flushTimer);
    flushTimer = undefined;
  }

  if (metricBuffer.size === 0) {
    return;
  }

  const bufferedMetrics = [...metricBuffer.values()];
  metricBuffer.clear();

  const config = getTelemetryConfig();
  if (config === undefined) {
    return;
  }

  const body: OtlpMetricsExportRequest = {
    resourceMetrics: [
      {
        resource: {
          attributes: toOtlpAttributes({
            'deployment.environment': config.environment,
            'service.name': config.serviceName,
            'service.version': config.serviceVersion,
          }),
        },
        scopeMetrics: [
          {
            metrics: bufferedMetrics.map((metric) => toOtlpMetric(metric)),
            scope: { name: 'application' },
          },
        ],
      },
    ],
  };

  try {
    await globalThis.fetch(`${config.otlpEndpoint}/v1/metrics`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  } catch (error) {
    logger.error('Failed to flush a batch of exemplar metrics', { error });
  }
};

const scheduleExemplarFlush = (): void => {
  if (flushTimer !== undefined) {
    return;
  }

  flushTimer = globalThis.setTimeout(() => {
    flushExemplarMetrics().catch((error: unknown) => {
      logger.error('Failed to flush a batch of exemplar metrics', { error });
    });
  }, FLUSH_INTERVAL_MS);
};

const recordGaugeWithExemplar = async (options: GaugeExemplarOptions): Promise<void> => {
  const config = getTelemetryConfig();
  if (config === undefined) {
    return;
  }

  const traceContext = getTraceContext();
  const timeUnixNano = `${BigInt(Date.now()) * 1_000_000n}`;
  const sessionId = getSessionId();

  const exemplarAttributes = {
    ...(sessionId === 'no-id' ? {} : { 'session.id': sessionId }),
    ...options.exemplarAttributes,
  };

  const dataPoint: OtlpNumberDataPoint = {
    asDouble: options.value,
    attributes: toOtlpAttributes(options.attributes ?? {}),
    exemplars:
      traceContext === undefined
        ? []
        : [
            {
              asDouble: options.value,
              ...(Object.keys(exemplarAttributes).length > 0
                ? { filteredAttributes: toOtlpAttributes(exemplarAttributes) }
                : {}),
              spanId: traceContext.spanId,
              timeUnixNano,
              traceId: traceContext.traceId,
            },
          ],
    timeUnixNano,
  };

  const bufferedMetric = metricBuffer.get(options.name) ?? {
    ...(options.description === undefined ? {} : { description: options.description }),
    dataPoints: [],
    name: options.name,
    ...(options.unit === undefined ? {} : { unit: options.unit }),
  };
  bufferedMetric.dataPoints.push(dataPoint);
  metricBuffer.set(options.name, bufferedMetric);

  if (countBufferedDataPoints() >= MAX_BUFFERED_DATA_POINTS) {
    await flushExemplarMetrics();
  } else {
    scheduleExemplarFlush();
  }
};

export {
  countBufferedDataPoints,
  flushExemplarMetrics,
  recordGaugeWithExemplar,
  scheduleExemplarFlush,
  toOtlpAttributes,
  toOtlpAttributeValue,
  toOtlpMetric,
};
export type {
  AttributeValue,
  BufferedMetric,
  GaugeExemplarOptions,
  OtlpAttributeValue,
  OtlpExemplar,
  OtlpKeyValue,
  OtlpMetric,
  OtlpMetricsExportRequest,
  OtlpNumberDataPoint,
};
