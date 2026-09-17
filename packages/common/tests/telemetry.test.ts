import { diag, metrics as otelMetricsApi, trace as otelTraceApi } from '@opentelemetry/api';
import { logs as otelLogsApi } from '@opentelemetry/api-logs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test';

import {
  PullMetricReader,
  flushTelemetry,
  initializeTelemetry,
  prometheusExporter,
  resetTelemetryForTests,
  shutdownTelemetry,
} from '../src/server/telemetry';
import { getTelemetryConfig } from '../src/utils';

const {
  forceFlushLoggerMock,
  forceFlushMeterMock,
  forceFlushTraceMock,
  getEnvMock,
  loggerDebugMock,
  loggerErrorMock,
  loggerInfoMock,
  registerMock,
  resourceFromAttributesMock,
  shutdownLoggerMock,
  shutdownMeterMock,
  shutdownTraceMock,
} = vi.hoisted(() => ({
  forceFlushLoggerMock: vi.fn().mockResolvedValue(undefined),
  forceFlushMeterMock: vi.fn().mockResolvedValue(undefined),
  forceFlushTraceMock: vi.fn().mockResolvedValue(undefined),
  getEnvMock: vi.fn((_key: string): string | undefined => undefined),
  loggerDebugMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  registerMock: vi.fn(),
  resourceFromAttributesMock: vi.fn((attributes: Record<string, string>) => attributes),
  shutdownLoggerMock: vi.fn().mockResolvedValue(undefined),
  shutdownMeterMock: vi.fn().mockResolvedValue(undefined),
  shutdownTraceMock: vi.fn().mockResolvedValue(undefined),
}));

interface ReaderLike {
  forceFlush: () => Promise<void>;
  shutdown: () => Promise<void>;
}

vi.mock('@opentelemetry/sdk-trace-web', () => {
  class MockWebTracerProvider {
    public forceFlush = forceFlushTraceMock;
    public shutdown = shutdownTraceMock;

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
    public forceFlush = forceFlushLoggerMock;
    public getLogger = vi.fn(() => ({}));
    public shutdown = shutdownLoggerMock;
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
  class MockMetricReader {
    protected baseHookCalls = 0;

    protected async onForceFlush(): Promise<void> {
      await Promise.resolve();
      this.baseHookCalls += 1;
    }

    protected async onShutdown(): Promise<void> {
      await Promise.resolve();
      this.baseHookCalls += 1;
    }

    public async collect(): Promise<{
      resourceMetrics: { resource: { attributes: object }; scopeMetrics: unknown[] };
    }> {
      await Promise.resolve();
      this.baseHookCalls += 1;
      return { resourceMetrics: { resource: { attributes: {} }, scopeMetrics: [] } };
    }

    public async forceFlush(): Promise<void> {
      await this.onForceFlush();
    }

    public async shutdown(): Promise<void> {
      await this.onShutdown();
    }
  }

  class MockPeriodicExportingMetricReader extends MockMetricReader {}

  class MockMeterProvider {
    private readonly readers: ReaderLike[];
    public getMeter = vi.fn(() => ({}));

    public constructor(options: { readers?: ReaderLike[] } = {}) {
      this.readers = options.readers ?? [];
    }

    public async forceFlush(): Promise<void> {
      await forceFlushMeterMock();
      await Promise.all(
        this.readers.map(async (reader) => {
          await reader.forceFlush();
        }),
      );
    }

    public async shutdown(): Promise<void> {
      await shutdownMeterMock();
      await Promise.all(
        this.readers.map(async (reader) => {
          await reader.shutdown();
        }),
      );
    }
  }

  return {
    MeterProvider: MockMeterProvider,
    MetricReader: MockMetricReader,
    PeriodicExportingMetricReader: MockPeriodicExportingMetricReader,
  };
});

vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn(() => []),
}));

vi.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes: resourceFromAttributesMock,
}));

vi.mock('../src/logger', () => ({
  logger: { debug: loggerDebugMock, error: loggerErrorMock, info: loggerInfoMock },
}));

vi.mock('../src/environment', () => ({
  getEnv: getEnvMock,
}));

let envOverrides: Record<string, string | undefined> = {};

beforeEach(() => {
  envOverrides = {};
  getEnvMock.mockImplementation((key: string) => envOverrides[key]);
});

afterEach(() => {
  vi.clearAllMocks();
});

test('prometheusExporter.getMetricsResponse returns 503 before telemetry has ever been initialized', async () => {
  const response = await prometheusExporter.getMetricsResponse();
  expect(response.status).toBe(503);
  expect(await response.text()).toBe('Metrics not initialized');
});

describe('PullMetricReader', () => {
  test('tracks stopped state and only logs on force-flush after being stopped', async () => {
    const reader = new PullMetricReader();
    expect(reader.isStopped).toBe(false);

    await reader.forceFlush();
    expect(loggerDebugMock).not.toHaveBeenCalled();

    await reader.shutdown();
    expect(reader.isStopped).toBe(true);

    await reader.forceFlush();
    expect(loggerDebugMock).toHaveBeenCalledWith(
      'PullMetricReader force-flushed after being stopped',
    );
  });
});

describe('initializeTelemetry', () => {
  afterEach(() => {
    resetTelemetryForTests();
  });

  test('uses caller-supplied service metadata', async () => {
    await initializeTelemetry({
      otlpEndpoint: 'http://otlp.example.com',
      serviceName: '@acme/api',
      serviceVersion: '1.0.0',
    });

    expect(resourceFromAttributesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        'service.name': '@acme/api',
        'service.version': '1.0.0',
      }),
    );
    expect(registerMock).toHaveBeenCalled();
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'OpenTelemetry initialized',
      expect.objectContaining({ serviceName: '@acme/api' }),
    );
  });

  test('is a no-op on a second call while already initialized', async () => {
    await initializeTelemetry({ serviceName: 'first' });
    registerMock.mockClear();
    resourceFromAttributesMock.mockClear();

    await initializeTelemetry({ serviceName: 'second' });

    expect(registerMock).not.toHaveBeenCalled();
    expect(resourceFromAttributesMock).not.toHaveBeenCalled();
  });

  test('falls back to env vars for service name, version, and OTLP endpoint', async () => {
    envOverrides['SERVICE_NAME'] = 'env-service';
    envOverrides['SERVICE_VERSION'] = '2.0.0';
    envOverrides['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://env-otlp.example.com';

    await initializeTelemetry();

    expect(resourceFromAttributesMock).toHaveBeenCalledWith(
      expect.objectContaining({ 'service.name': 'env-service', 'service.version': '2.0.0' }),
    );
  });

  test('falls back to hard-coded defaults when nothing is configured', async () => {
    await initializeTelemetry();

    expect(resourceFromAttributesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        'service.name': '@lightproject/app',
        'service.version': '1.0.0',
      }),
    );
  });

  test('enables the diag console logger when TELEMETRY_DEBUG=true', async () => {
    const setLoggerSpy = vi.spyOn(diag, 'setLogger').mockImplementation(() => true);
    envOverrides['TELEMETRY_DEBUG'] = 'true';

    await initializeTelemetry();

    expect(setLoggerSpy).toHaveBeenCalled();
    setLoggerSpy.mockRestore();
  });

  test('does not touch the diag logger when TELEMETRY_DEBUG is unset', async () => {
    const setLoggerSpy = vi.spyOn(diag, 'setLogger').mockImplementation(() => true);

    await initializeTelemetry();

    expect(setLoggerSpy).not.toHaveBeenCalled();
    setLoggerSpy.mockRestore();
  });
});

describe('flushTelemetry', () => {
  afterEach(() => {
    resetTelemetryForTests();
  });

  test('resolves without flushing anything when telemetry has not been initialized', async () => {
    await flushTelemetry();
    expect(forceFlushTraceMock).not.toHaveBeenCalled();
  });

  test('force-flushes the trace, meter, and logger providers when initialized', async () => {
    await initializeTelemetry({ serviceName: 'flush-test' });

    await flushTelemetry();

    expect(forceFlushTraceMock).toHaveBeenCalled();
    expect(forceFlushMeterMock).toHaveBeenCalled();
    expect(forceFlushLoggerMock).toHaveBeenCalled();
  });

  test('logs an error instead of throwing when a flush fails', async () => {
    await initializeTelemetry({ serviceName: 'flush-error-test' });
    forceFlushTraceMock.mockImplementationOnce(() => {
      throw new Error('flush failed');
    });

    await expect(flushTelemetry()).resolves.toBeUndefined();
    expect(loggerErrorMock).toHaveBeenCalledWith('Failed to flush telemetry', expect.any(Object));
  });
});

describe('shutdownTelemetry', () => {
  afterEach(() => {
    resetTelemetryForTests();
  });

  test('resolves without doing anything when telemetry has not been initialized', async () => {
    await shutdownTelemetry();
    expect(shutdownTraceMock).not.toHaveBeenCalled();
  });

  test('shuts down the trace, meter, and logger providers when initialized', async () => {
    await initializeTelemetry({ serviceName: 'shutdown-test' });

    await shutdownTelemetry();

    expect(shutdownTraceMock).toHaveBeenCalled();
    expect(shutdownMeterMock).toHaveBeenCalled();
    expect(shutdownLoggerMock).toHaveBeenCalled();
  });

  test('logs an error instead of throwing when shutdown fails', async () => {
    await initializeTelemetry({ serviceName: 'shutdown-error-test' });
    shutdownTraceMock.mockRejectedValueOnce(new Error('shutdown failed'));

    await expect(shutdownTelemetry()).resolves.toBeUndefined();
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Failed to shutdown OpenTelemetry',
      expect.any(Object),
    );
  });
});

describe('prometheusExporter.getMetricsResponse once initialized', () => {
  afterEach(() => {
    resetTelemetryForTests();
  });

  test('returns a 200 plain-text Prometheus response while metrics are active', async () => {
    await initializeTelemetry({ serviceName: 'metrics-test' });

    const response = await prometheusExporter.getMetricsResponse();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(typeof (await response.text())).toBe('string');
  });

  test('returns 503 once the pull metric reader has been stopped via shutdown', async () => {
    await initializeTelemetry({ serviceName: 'metrics-stop-test' });
    await shutdownTelemetry();

    const response = await prometheusExporter.getMetricsResponse();

    expect(response.status).toBe(503);
  });
});

describe('getTelemetryConfig', () => {
  afterEach(() => {
    resetTelemetryForTests();
  });

  test('returns undefined before initialization', () => {
    expect(getTelemetryConfig()).toBeUndefined();
  });

  test('returns the resolved config after initialization', async () => {
    await initializeTelemetry({
      otlpEndpoint: 'http://otlp.example.com',
      serviceName: '@acme/api',
      serviceVersion: '1.0.0',
    });

    expect(getTelemetryConfig()).toStrictEqual({
      environment: 'local',
      otlpEndpoint: 'http://otlp.example.com',
      serviceName: '@acme/api',
      serviceVersion: '1.0.0',
    });
  });
});

describe('resetTelemetryForTests', () => {
  test('disables the global trace, metrics, and logs providers', () => {
    const traceDisableSpy = vi.spyOn(otelTraceApi, 'disable');
    const metricsDisableSpy = vi.spyOn(otelMetricsApi, 'disable');
    const logsDisableSpy = vi.spyOn(otelLogsApi, 'disable');

    resetTelemetryForTests();

    expect(traceDisableSpy).toHaveBeenCalled();
    expect(metricsDisableSpy).toHaveBeenCalled();
    expect(logsDisableSpy).toHaveBeenCalled();

    traceDisableSpy.mockRestore();
    metricsDisableSpy.mockRestore();
    logsDisableSpy.mockRestore();
  });
});
