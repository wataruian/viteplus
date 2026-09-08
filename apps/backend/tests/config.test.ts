import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

afterEach(() => {
  vi.unstubAllEnvs();
});

const importConfig = async () => {
  vi.resetModules();
  const { config } = await import('../src/config');
  return config;
};

describe('config.apiPort', () => {
  test('defaults to 3000 when API_PORT is not set', async () => {
    vi.stubEnv('API_PORT', undefined);
    const config = await importConfig();
    expect(config.apiPort).toBe(3000);
  });

  test('uses API_PORT when set', async () => {
    vi.stubEnv('API_PORT', '4321');
    const config = await importConfig();
    expect(config.apiPort).toBe(4321);
  });
});

describe('config.enableErrorStack', () => {
  test('is false in production regardless of ENABLE_ERROR_STACK', async () => {
    vi.stubEnv('ENV', 'production');
    vi.stubEnv('ENABLE_ERROR_STACK', 'true');
    const config = await importConfig();
    expect(config.enableErrorStack).toBe(false);
  });

  test('uses the explicit ENABLE_ERROR_STACK value outside production', async () => {
    vi.stubEnv('ENV', 'staging');
    vi.stubEnv('ENABLE_ERROR_STACK', 'true');
    const config = await importConfig();
    expect(config.enableErrorStack).toBe(true);

    vi.stubEnv('ENABLE_ERROR_STACK', 'false');
    expect(config.enableErrorStack).toBe(false);
  });

  test('defaults to isLocal() when ENABLE_ERROR_STACK is unset', async () => {
    vi.stubEnv('ENABLE_ERROR_STACK', undefined);
    vi.stubEnv('ENV', 'local');
    const config = await importConfig();
    expect(config.enableErrorStack).toBe(true);

    vi.stubEnv('ENV', 'staging');
    expect(config.enableErrorStack).toBe(false);
  });
});

describe('config.skipOpenTelemetry', () => {
  test('defaults to false', async () => {
    vi.stubEnv('SKIP_OPENTELEMETRY', undefined);
    const config = await importConfig();
    expect(config.skipOpenTelemetry).toBe(false);
  });

  test('is true when SKIP_OPENTELEMETRY=true', async () => {
    vi.stubEnv('SKIP_OPENTELEMETRY', 'true');
    const config = await importConfig();
    expect(config.skipOpenTelemetry).toBe(true);
  });
});
