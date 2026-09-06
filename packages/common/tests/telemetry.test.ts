import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';

import { initializeTelemetry } from '../src/server/telemetry';

const { registerMock, shutdownMock, resourceFromAttributesMock } = vi.hoisted(() => ({
  registerMock: vi.fn(),
  resourceFromAttributesMock: vi.fn((attributes: Record<string, string>) => attributes),
  shutdownMock: vi.fn(),
}));

vi.mock('@opentelemetry/sdk-trace-web', () => {
  class MockWebTracerProvider {
    public forceFlush = vi.fn();
    public shutdown = vi.fn(shutdownMock);

    public register() {
      registerMock();
      return this;
    }
  }

  return {
    BatchSpanProcessor: vi.fn(),
    SimpleSpanProcessor: vi.fn(),
    WebTracerProvider: MockWebTracerProvider,
  };
});

vi.mock('@opentelemetry/sdk-logs', () => {
  class MockLoggerProvider {
    public forceFlush = vi.fn();
    public shutdown = vi.fn();
    public getLogger = vi.fn(() => ({}));
  }
  return {
    BatchLogRecordProcessor: vi.fn(),
    LoggerProvider: MockLoggerProvider,
    SimpleLogRecordProcessor: vi.fn(),
  };
});

vi.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({
  OTLPMetricExporter: vi.fn(),
}));

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: vi.fn(),
}));

vi.mock('@opentelemetry/sdk-metrics', () => {
  class MockMeterProvider {
    public forceFlush = vi.fn();
    public getMeter = vi.fn(() => ({}));
    public shutdown = vi.fn();
  }

  class MockMetricReader {}

  return {
    MeterProvider: MockMeterProvider,
    MetricReader: MockMetricReader,
    PeriodicExportingMetricReader: vi.fn(),
  };
});

vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn(() => []),
}));

vi.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes: resourceFromAttributesMock,
}));

vi.mock('@lightproject/common/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../src/environment', () => ({
  getEnv: vi.fn(() => undefined),
}));

describe('initializeTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('uses caller-supplied service metadata', async () => {
    await initializeTelemetry({ serviceName: '@acme/api', serviceVersion: '1.0.0' });

    expect(resourceFromAttributesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        'service.name': '@acme/api',
        'service.version': '1.0.0',
      }),
    );
    expect(registerMock).toHaveBeenCalled();
  });
});
