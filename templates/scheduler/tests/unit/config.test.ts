import { describe, expect, test, vi } from 'vite-plus/test';

const importConfig = async () => {
  vi.resetModules();
  const { config } = await import('../../src/config');
  return config;
};

describe('config', () => {
  test('reads SKIP_OPENTELEMETRY', async () => {
    vi.stubEnv('SKIP_OPENTELEMETRY', 'false');
    const disabled = await importConfig();
    vi.stubEnv('SKIP_OPENTELEMETRY', 'true');
    const enabled = await importConfig();
    vi.unstubAllEnvs();

    expect(disabled.skipOpenTelemetry).toBe(false);
    expect(enabled.skipOpenTelemetry).toBe(true);
  });
});
