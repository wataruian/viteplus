import type { TracingInstrumentationOptions } from '@grafana/faro-web-tracing';
import type * as OtelApi from '@opentelemetry/api';
import type * as SdkTraceWeb from '@opentelemetry/sdk-trace-web';
import type { ReadableSpan, SpanExporter, SpanProcessor } from '@opentelemetry/sdk-trace-web';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import type * as RumModule from '../../src/browser/rum';
import {
  type FaroLogSinkApi,
  createFaroLogSink,
  flushRum,
  registerLifecycleFlush,
} from '../../src/browser/rum';
import type { BrowserLogSink, LogEntry } from '../../src/logger';

interface FaroTraceExporterConfig {
  api: { fakeFaroApi: boolean };
}

const {
  faroMetasStub,
  faroTraceExporterExportMock,
  faroTraceExporterMock,
  faroTraceExporterShutdownMock,
  flushExemplarMetricsMock,
  forceFlushMock,
  getClientIdMock,
  tracingInstrumentationMock,
  initializeFaroMock,
  registerBrowserLogSinkMock,
  resourceFromAttributesMock,
  setGlobalMeterProviderMock,
  setTelemetryConfigMock,
  otlpMetricExporterMock,
} = vi.hoisted(() => ({
  faroMetasStub: { value: {} },
  faroTraceExporterExportMock:
    vi.fn<(spans: ReadableSpan[], config: FaroTraceExporterConfig) => void>(),
  faroTraceExporterMock: vi.fn<(config: FaroTraceExporterConfig) => void>(),
  faroTraceExporterShutdownMock: vi.fn<(config: FaroTraceExporterConfig) => void>(),
  flushExemplarMetricsMock: vi.fn().mockResolvedValue(undefined),
  forceFlushMock: vi.fn().mockResolvedValue(undefined),
  getClientIdMock: vi.fn<() => string | undefined>(),
  initializeFaroMock: vi.fn(() => ({ initializedFaro: true })),
  otlpMetricExporterMock:
    vi.fn<(options: { temporalityPreference?: number; url: string }) => void>(),
  registerBrowserLogSinkMock: vi.fn<(sink: BrowserLogSink | undefined) => void>(),
  resourceFromAttributesMock: vi.fn((attributes: Record<string, string>) => attributes),
  setGlobalMeterProviderMock: vi.fn(),
  setTelemetryConfigMock: vi.fn(),
  tracingInstrumentationMock: vi.fn<(options: TracingInstrumentationOptions) => void>(),
}));

vi.mock('@grafana/faro-web-sdk', () => ({
  LogLevel: { DEBUG: 'debug', ERROR: 'error', INFO: 'info', WARN: 'warn' },
  faro: { api: { fakeFaroApi: true }, metas: faroMetasStub, staticFaroExport: true },
  getWebInstrumentations: vi.fn(() => ['web-instrumentation']),
  initializeFaro: initializeFaroMock,
}));

vi.mock('../../src/logger', () => ({
  getClientId: getClientIdMock,
  registerBrowserLogSink: registerBrowserLogSinkMock,
}));

vi.mock('@grafana/faro-web-tracing', () => {
  class MockFaroMetaAttributesSpanProcessor implements SpanProcessor {
    private readonly processor: SpanProcessor;

    public constructor(processor: SpanProcessor, metas: typeof faroMetasStub) {
      expect(metas).toBe(faroMetasStub);
      this.processor = processor;
    }

    public async forceFlush(): Promise<void> {
      await this.processor.forceFlush();
    }

    public onStart(...args: Parameters<SpanProcessor['onStart']>): void {
      this.processor.onStart(...args);
    }

    public onEnd(span: ReadableSpan): void {
      this.processor.onEnd(span);
    }

    public async shutdown(): Promise<void> {
      await this.processor.shutdown();
    }
  }
  class MockFaroTraceExporter implements SpanExporter {
    private readonly config: FaroTraceExporterConfig;

    public constructor(config: FaroTraceExporterConfig) {
      faroTraceExporterMock(config);
      this.config = config;
    }

    public export(...[spans, resultCallback]: Parameters<SpanExporter['export']>): void {
      faroTraceExporterExportMock(spans, this.config);
      resultCallback({ code: 0 });
    }

    public async shutdown(): Promise<void> {
      faroTraceExporterShutdownMock(this.config);
      await Promise.resolve();
    }
  }
  return {
    FaroMetaAttributesSpanProcessor: MockFaroMetaAttributesSpanProcessor,
    FaroTraceExporter: MockFaroTraceExporter,
    TracingInstrumentation: Object.assign(tracingInstrumentationMock, {
      SCHEDULED_BATCH_DELAY_MS: 1000,
    }),
  };
});

vi.mock('@opentelemetry/api', () => ({
  metrics: { setGlobalMeterProvider: setGlobalMeterProviderMock },
}));

vi.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({
  AggregationTemporalityPreference: { CUMULATIVE: 0, DELTA: 1, LOWMEMORY: 2 },
  OTLPMetricExporter: otlpMetricExporterMock,
}));

vi.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes: resourceFromAttributesMock,
}));

vi.mock('@opentelemetry/sdk-metrics', () => {
  class MockMeterProvider {
    public forceFlush = forceFlushMock;
  }
  return {
    MeterProvider: MockMeterProvider,
    PeriodicExportingMetricReader: vi.fn(),
  };
});

vi.mock('../../src/utils/telemetry', () => ({
  METRIC_EXPORT_INTERVAL_MS: 5000,
  getServiceInstanceId: () => 'test-instance-id',
  setTelemetryConfig: setTelemetryConfigMock,
}));

vi.mock('../../src/utils/exemplar-metrics', () => ({
  flushExemplarMetrics: flushExemplarMetricsMock,
}));

const importFreshRumModule = async (): Promise<typeof RumModule> => {
  vi.resetModules();
  return await import('../../src/browser/rum');
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('flushRum', () => {
  test('resolves without throwing when no meter provider has been initialized', async () => {
    await expect(flushRum()).resolves.toBeUndefined();
  });

  test('also flushes any buffered exemplar metrics', async () => {
    await flushRum();

    expect(flushExemplarMetricsMock).toHaveBeenCalled();
  });
});

const startTracing = async () => {
  const rum = await importFreshRumModule();
  rum.initializeRum({ serviceName: 'span-pipeline' });
  const spanProcessor = tracingInstrumentationMock.mock.calls.at(-1)?.[0].spanProcessor;
  if (spanProcessor === undefined) {
    throw new Error('expected initializeRum to hand Faro a span processor');
  }
  const { WebTracerProvider } = await vi.importActual<typeof SdkTraceWeb>(
    '@opentelemetry/sdk-trace-web',
  );
  const tracer = new WebTracerProvider({ spanProcessors: [spanProcessor] }).getTracer('test');
  return { rum, spanProcessor, tracer };
};

describe('Faro span pipeline', () => {
  test('exports metrics every 5s instead of the 60s default', async () => {
    const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics');
    await startTracing();

    expect(PeriodicExportingMetricReader).toHaveBeenCalledWith(
      expect.objectContaining({ exportIntervalMillis: 5000, exportTimeoutMillis: 5000 }),
    );
  });

  test('flushing before any span has started is a no-op', async () => {
    const { rum, spanProcessor } = await startTracing();

    await rum.flushRum();
    await spanProcessor.shutdown();

    expect(faroTraceExporterMock).not.toHaveBeenCalled();
  });

  test("builds Faro's default pipeline on the first span, against the initialized faro api and metas", async () => {
    const { tracer } = await startTracing();

    tracer.startSpan('first').end();
    tracer.startSpan('second').end();

    expect(faroTraceExporterMock).toHaveBeenCalledTimes(1);
    expect(faroTraceExporterMock).toHaveBeenCalledWith({ api: { fakeFaroApi: true } });
  });

  test('flushRum hands buffered spans to the Faro transport synchronously, before any await', async () => {
    const { rum, tracer } = await startTracing();

    tracer.startSpan('fetch').end();
    expect(faroTraceExporterExportMock).not.toHaveBeenCalled();

    const flushed = rum.flushRum();
    expect(faroTraceExporterExportMock).toHaveBeenCalledTimes(1);
    expect(faroTraceExporterExportMock.mock.calls[0]?.[0].map((span) => span.name)).toEqual([
      'fetch',
    ]);
    await flushed;
  });

  test('shutdown is forwarded to the built pipeline', async () => {
    const { spanProcessor, tracer } = await startTracing();

    tracer.startSpan('before-shutdown').end();
    await spanProcessor.shutdown();

    expect(faroTraceExporterExportMock).toHaveBeenCalledTimes(1);
    expect(faroTraceExporterShutdownMock).toHaveBeenCalledWith({ api: { fakeFaroApi: true } });
  });
});

describe('registerLifecycleFlush', () => {
  test('does nothing outside a browser environment (no window/document)', () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);

    expect(() => {
      registerLifecycleFlush();
    }).not.toThrow();
  });
});

describe('initializeRum', () => {
  test('uses explicitly provided options for every field', async () => {
    const rum = await importFreshRumModule();

    rum.initializeRum({
      environment: 'custom-env',
      faroEndpoint: 'https://faro.example.com',
      otlpEndpoint: 'https://otlp.example.com',
      serviceName: 'my-service',
      serviceVersion: '9.9.9',
    });

    expect(resourceFromAttributesMock).toHaveBeenCalledWith({
      'deployment.environment': 'custom-env',
      'deployment.environment.name': 'custom-env',
      'service.instance.id': 'test-instance-id',
      'service.name': 'my-service',
      'service.version': '9.9.9',
    });
    expect(initializeFaroMock).toHaveBeenCalledWith(
      expect.objectContaining({
        app: { environment: 'custom-env', name: 'my-service', version: '9.9.9' },
        url: 'https://faro.example.com/collect',
      }),
    );
    expect(setGlobalMeterProviderMock).toHaveBeenCalled();
    expect(otlpMetricExporterMock.mock.calls.at(-1)?.[0]).toMatchObject({
      temporalityPreference: 1,
    });
    expect(setTelemetryConfigMock).toHaveBeenCalledWith({
      environment: 'custom-env',
      otlpEndpoint: 'https://otlp.example.com',
      serviceName: 'my-service',
      serviceVersion: '9.9.9',
    });
  });

  test('falls back to primary env vars when options are omitted', async () => {
    const rum = await importFreshRumModule();

    vi.stubEnv('SERVICE_NAME', 'env-service');
    vi.stubEnv('SERVICE_VERSION', '2.0.0');
    vi.stubEnv('ENV', 'staging');
    vi.stubEnv('FARO_ENDPOINT', 'https://faro.env.example.com');
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'https://otlp.env.example.com');

    rum.initializeRum();

    expect(resourceFromAttributesMock).toHaveBeenCalledWith({
      'deployment.environment': 'staging',
      'deployment.environment.name': 'staging',
      'service.instance.id': 'test-instance-id',
      'service.name': 'env-service',
      'service.version': '2.0.0',
    });
    expect(initializeFaroMock).toHaveBeenCalledWith(
      expect.objectContaining({
        app: { environment: 'staging', name: 'env-service', version: '2.0.0' },
        url: 'https://faro.env.example.com/collect',
      }),
    );
  });

  test('falls back to VITE_-prefixed env vars when primary vars are unset', async () => {
    const rum = await importFreshRumModule();

    vi.stubEnv('SERVICE_NAME', undefined);
    vi.stubEnv('SERVICE_VERSION', undefined);
    vi.stubEnv('ENV', undefined);
    vi.stubEnv('FARO_ENDPOINT', undefined);
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', undefined);

    vi.stubEnv('VITE_SERVICE_NAME', 'vite-service');
    vi.stubEnv('VITE_SERVICE_VERSION', '3.0.0');
    vi.stubEnv('VITE_ENV', 'vite-staging');
    vi.stubEnv('VITE_FARO_ENDPOINT', 'https://faro.vite.example.com');
    vi.stubEnv('VITE_OTEL_EXPORTER_OTLP_ENDPOINT', 'https://otlp.vite.example.com');

    rum.initializeRum();

    expect(resourceFromAttributesMock).toHaveBeenCalledWith({
      'deployment.environment': 'vite-staging',
      'deployment.environment.name': 'vite-staging',
      'service.instance.id': 'test-instance-id',
      'service.name': 'vite-service',
      'service.version': '3.0.0',
    });
    expect(initializeFaroMock).toHaveBeenCalledWith(
      expect.objectContaining({
        app: { environment: 'vite-staging', name: 'vite-service', version: '3.0.0' },
        url: 'https://faro.vite.example.com/collect',
      }),
    );
  });

  test('uses hard-coded defaults when nothing is configured', async () => {
    const rum = await importFreshRumModule();

    vi.stubEnv('SERVICE_NAME', undefined);
    vi.stubEnv('SERVICE_VERSION', undefined);
    vi.stubEnv('ENV', undefined);
    vi.stubEnv('FARO_ENDPOINT', undefined);
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', undefined);
    vi.stubEnv('VITE_SERVICE_NAME', undefined);
    vi.stubEnv('VITE_SERVICE_VERSION', undefined);
    vi.stubEnv('VITE_ENV', undefined);
    vi.stubEnv('VITE_FARO_ENDPOINT', undefined);
    vi.stubEnv('VITE_OTEL_EXPORTER_OTLP_ENDPOINT', undefined);

    rum.initializeRum();

    expect(resourceFromAttributesMock).toHaveBeenCalledWith({
      'deployment.environment': 'local',
      'deployment.environment.name': 'local',
      'service.instance.id': 'test-instance-id',
      'service.name': '@lightproject/app',
      'service.version': '1.0.0',
    });
    expect(initializeFaroMock).toHaveBeenCalledWith(
      expect.objectContaining({
        app: { environment: 'local', name: '@lightproject/app', version: '1.0.0' },
        url: 'http://localhost:12347/collect',
      }),
    );
  });

  test('short-circuits on subsequent calls, returning the static faro export without reinitializing', async () => {
    const rum = await importFreshRumModule();

    const first = rum.initializeRum({ serviceName: 'once' });
    const second = rum.initializeRum({ serviceName: 'twice' });

    expect(first).not.toBe(second);
    expect(second).toStrictEqual({
      api: { fakeFaroApi: true },
      metas: faroMetasStub,
      staticFaroExport: true,
    });
    expect(initializeFaroMock).toHaveBeenCalledTimes(1);
    expect(resourceFromAttributesMock).toHaveBeenCalledTimes(1);
  });

  test('registers a lifecycle flush that runs only when the page becomes hidden, swallowing flush errors', async () => {
    const rum = await importFreshRumModule();
    rum.initializeRum({ serviceName: 'lifecycle' });

    const documentListener = vi.fn<(eventName: string, listener: () => void) => void>();
    const globalListener = vi.fn<(eventName: string, listener: () => void) => void>();
    const documentStub: { addEventListener: typeof documentListener; visibilityState: string } = {
      addEventListener: documentListener,
      visibilityState: 'visible',
    };

    vi.stubGlobal('window', {});
    vi.stubGlobal('document', documentStub);
    vi.stubGlobal('addEventListener', globalListener);

    rum.registerLifecycleFlush();

    expect(documentListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(globalListener).toHaveBeenCalledWith('pagehide', expect.any(Function));

    const [, flushOnHide] = documentListener.mock.calls[0] ?? ['', () => {}];

    documentStub.visibilityState = 'visible';
    flushOnHide();
    expect(forceFlushMock).not.toHaveBeenCalled();

    forceFlushMock.mockRejectedValueOnce(new Error('flush failed'));
    documentStub.visibilityState = 'hidden';
    flushOnHide();

    await vi.waitFor(() => {
      expect(forceFlushMock).toHaveBeenCalledTimes(1);
    });
  });

  test('swallows a synchronous flush failure raised when the page becomes hidden, without producing an unhandled rejection', async () => {
    const rum = await importFreshRumModule();
    rum.initializeRum({ serviceName: 'lifecycle-sync-failure' });

    const documentListener = vi.fn<(eventName: string, listener: () => void) => void>();
    const documentStub: { addEventListener: typeof documentListener; visibilityState: string } = {
      addEventListener: documentListener,
      visibilityState: 'hidden',
    };

    vi.stubGlobal('window', {});
    vi.stubGlobal('document', documentStub);
    vi.stubGlobal('addEventListener', vi.fn());

    rum.registerLifecycleFlush();

    const [, flushOnHide] = documentListener.mock.calls[0] ?? ['', () => {}];

    flushExemplarMetricsMock.mockImplementationOnce(() => {
      throw new Error('synchronous flush failure');
    });

    const unhandledRejectionSpy = vi.fn();
    const handleUnhandledRejection = (reason: unknown): void => {
      unhandledRejectionSpy(reason);
    };
    globalThis.process.on('unhandledRejection', handleUnhandledRejection);

    flushOnHide();
    await Promise.resolve();
    await Promise.resolve();

    expect(unhandledRejectionSpy).not.toHaveBeenCalled();

    globalThis.process.off('unhandledRejection', handleUnhandledRejection);
  });
});

const createFakeFaro = () => {
  const api = {
    pushLog: vi.fn<FaroLogSinkApi['pushLog']>(),
  } satisfies FaroLogSinkApi;
  return { api, instance: { api } };
};

const logEntry: LogEntry = { level: 'warn', message: 'hello', timestamp: 't' };

describe('Faro log sink', () => {
  test('initializeRum registers a sink backed by the initialized Faro instance', async () => {
    const rum = await importFreshRumModule();
    registerBrowserLogSinkMock.mockClear();

    rum.initializeRum();

    expect(registerBrowserLogSinkMock).toHaveBeenCalledTimes(1);
    const [registeredSink] = registerBrowserLogSinkMock.mock.calls[0] ?? [];
    expect(typeof registeredSink?.pushLog).toBe('function');
  });

  test('pushLog forwards the serialized entry at the mapped Faro level, with an explicit span context', () => {
    const { api, instance } = createFakeFaro();

    createFaroLogSink(instance).pushLog({ ...logEntry, spanId: 'span-1', traceId: 'trace-1' });

    expect(api.pushLog).toHaveBeenCalledWith(
      [JSON.stringify({ ...logEntry, spanId: 'span-1', traceId: 'trace-1' })],
      { level: 'warn', spanContext: { spanId: 'span-1', traceId: 'trace-1' } },
    );
  });

  test('pushLog omits spanContext when the entry has no trace context', () => {
    const { api, instance } = createFakeFaro();

    createFaroLogSink(instance).pushLog(logEntry);

    expect(api.pushLog).toHaveBeenCalledWith([JSON.stringify(logEntry)], { level: 'warn' });
  });

  test('pushLog forwards requestId and clientId as Faro log context so the collector can promote them', () => {
    const { api, instance } = createFakeFaro();
    const entry = { ...logEntry, clientId: 'client-1', requestId: 'req-1' };

    createFaroLogSink(instance).pushLog(entry);

    expect(api.pushLog).toHaveBeenCalledWith([JSON.stringify(entry)], {
      context: { clientId: 'client-1', requestId: 'req-1' },
      level: 'warn',
    });
  });
});

const createSpanSpy = async () => {
  const { trace } = await vi.importActual<typeof OtelApi>('@opentelemetry/api');
  const span = trace.wrapSpanContext({
    spanId: 'b7ad6b7169203331',
    traceFlags: 1,
    traceId: '0af7651916cd43dd8448eb211c80319c',
  });
  return { setAttribute: vi.spyOn(span, 'setAttribute'), span };
};

const getInstrumentationOptions = async () => {
  const rum = await importFreshRumModule();
  rum.initializeRum({ otlpEndpoint: 'https://otlp.example.com' });
  return tracingInstrumentationMock.mock.calls.at(-1)?.[0].instrumentationOptions;
};

describe('browser span ids', () => {
  test('fetch spans get the request.id the call sent as X-Request-Id, plus the page client.id', async () => {
    getClientIdMock.mockReturnValue('page-client-id');
    const options = await getInstrumentationOptions();
    const { setAttribute, span } = await createSpanSpy();

    options?.fetchInstrumentationOptions?.applyCustomAttributesOnSpan?.(
      span,
      { headers: { 'X-Request-Id': 'req-1' } },
      new globalThis.Response(),
    );

    expect(setAttribute.mock.calls).toStrictEqual([
      ['request.id', 'req-1'],
      ['client.id', 'page-client-id'],
    ]);
  });

  test('fetch spans without X-Request-Id only get client.id', async () => {
    getClientIdMock.mockReturnValue('page-client-id');
    const options = await getInstrumentationOptions();
    const { setAttribute, span } = await createSpanSpy();

    options?.fetchInstrumentationOptions?.applyCustomAttributesOnSpan?.(
      span,
      {},
      new globalThis.Response(),
    );
    expect(setAttribute.mock.calls).toStrictEqual([['client.id', 'page-client-id']]);
  });

  test('XHR spans get the page client.id', async () => {
    getClientIdMock.mockReturnValue('page-client-id');
    const rum = await importFreshRumModule();
    rum.initializeRum();
    const options = tracingInstrumentationMock.mock.calls.at(-1)?.[0].instrumentationOptions;
    const { setAttribute, span } = await createSpanSpy();

    expect(options?.xhrInstrumentationOptions?.applyCustomAttributesOnSpan).toBe(rum.tagXhrSpan);
    rum.tagXhrSpan(span);

    expect(setAttribute.mock.calls).toStrictEqual([['client.id', 'page-client-id']]);
  });

  test('spans get no ids when there is no request or client id', async () => {
    getClientIdMock.mockReturnValue(undefined);
    const options = await getInstrumentationOptions();
    const { setAttribute, span } = await createSpanSpy();

    options?.fetchInstrumentationOptions?.applyCustomAttributesOnSpan?.(
      span,
      {},
      new globalThis.Response(),
    );

    expect(setAttribute).not.toHaveBeenCalled();
  });

  test('does not trace our own OTLP exports', async () => {
    await getInstrumentationOptions();

    expect(initializeFaroMock).toHaveBeenCalledWith(
      expect.objectContaining({ ignoreUrls: [/^https:\/\/otlp\.example\.com/u] }),
    );
  });
});
