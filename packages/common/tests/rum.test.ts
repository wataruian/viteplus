import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import type * as RumModule from '../src/utils/rum';
import { flushRum, registerLifecycleFlush } from '../src/utils/rum';

const {
  forceFlushMock,
  initializeFaroMock,
  resourceFromAttributesMock,
  setGlobalMeterProviderMock,
} = vi.hoisted(() => ({
  forceFlushMock: vi.fn().mockResolvedValue(undefined),
  initializeFaroMock: vi.fn(() => ({ initializedFaro: true })),
  resourceFromAttributesMock: vi.fn((attributes: Record<string, string>) => attributes),
  setGlobalMeterProviderMock: vi.fn(),
}));

vi.mock('../src/utils/helpers', () => ({
  getMetaEnv: () => ({}),
}));

vi.mock('@grafana/faro-web-sdk', () => ({
  faro: { staticFaroExport: true },
  getWebInstrumentations: vi.fn(() => ['web-instrumentation']),
  initializeFaro: initializeFaroMock,
}));

vi.mock('@grafana/faro-web-tracing', () => ({
  TracingInstrumentation: vi.fn(),
}));

vi.mock('@opentelemetry/api', () => ({
  metrics: { setGlobalMeterProvider: setGlobalMeterProviderMock },
}));

vi.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({
  OTLPMetricExporter: vi.fn(),
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

const importFreshRumModule = async (): Promise<typeof RumModule> => {
  vi.resetModules();
  const rumModule = await import('../src/utils/rum');
  return rumModule;
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
    expect(second).toStrictEqual({ staticFaroExport: true });
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
});
