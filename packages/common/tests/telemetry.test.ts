import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';

import { initializeTelemetry } from '../src/server/telemetry';

const { startMock, shutdownMock, resourceFromAttributesMock } = vi.hoisted(() => ({
  resourceFromAttributesMock: vi.fn((attributes: Record<string, string>) => attributes),
  shutdownMock: vi.fn(),
  startMock: vi.fn(),
}));

vi.mock('@opentelemetry/sdk-node', () => {
  class MockNodeSDK {
    public start() {
      startMock();
      return this;
    }

    public shutdown() {
      shutdownMock();
      return this;
    }
  }

  return {
    NodeSDK: MockNodeSDK,
  };
});

vi.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({
  OTLPMetricExporter: vi.fn(),
}));

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: vi.fn(),
}));

vi.mock('@opentelemetry/sdk-metrics', () => ({
  PeriodicExportingMetricReader: vi.fn(),
}));

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
    expect(startMock).toHaveBeenCalled();
  });
});
