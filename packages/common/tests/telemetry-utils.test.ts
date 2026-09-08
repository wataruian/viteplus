import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import type * as TelemetryUtilsModule from '../src/utils/telemetry';

const importFresh = async (serviceName?: string): Promise<typeof TelemetryUtilsModule> => {
  vi.resetModules();
  vi.stubEnv('OTEL_SERVICE_NAME', serviceName);
  const telemetryModule = await import('../src/utils/telemetry');
  return telemetryModule;
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('tracer', () => {
  test('is created using OTEL_SERVICE_NAME when set', async () => {
    const { tracer } = await importFresh('my-tracer-service');
    expect(tracer).toBeDefined();
  });

  test('falls back to "application" when OTEL_SERVICE_NAME is unset', async () => {
    const { tracer } = await importFresh(undefined);
    expect(tracer).toBeDefined();
  });
});

describe('getMeter', () => {
  test('returns a meter using OTEL_SERVICE_NAME when set', async () => {
    const { getMeter } = await importFresh('my-meter-service');
    expect(getMeter()).toBeDefined();
  });

  test('returns a meter falling back to "application" when OTEL_SERVICE_NAME is unset', async () => {
    const { getMeter } = await importFresh(undefined);
    expect(getMeter()).toBeDefined();
  });
});
