import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

afterEach(() => {
  vi.unstubAllEnvs();
});

const importConfig = async () => {
  vi.resetModules();
  const { config } = await import('../../src/config');
  return config;
};

const unsetBackendUrl = () => {
  vi.stubEnv('BACKEND_URL', undefined);
  vi.stubEnv('VITE_BACKEND_URL', undefined);
};

describe('config.backendPort', () => {
  test('defaults to 2000 when BACKEND_PORT is not set', async () => {
    vi.stubEnv('BACKEND_PORT', undefined);
    vi.stubEnv('VITE_BACKEND_PORT', undefined);
    const config = await importConfig();
    expect(config.backendPort).toBe(2000);
  });

  test('uses BACKEND_PORT when set', async () => {
    vi.stubEnv('BACKEND_PORT', '4321');
    const config = await importConfig();
    expect(config.backendPort).toBe(4321);
  });
});

describe('config.backendUrl', () => {
  test('defaults to localhost on the default port', async () => {
    unsetBackendUrl();
    vi.stubEnv('BACKEND_PORT', undefined);
    vi.stubEnv('VITE_BACKEND_PORT', undefined);
    const config = await importConfig();
    expect(config.backendUrl).toBe('http://localhost:2000');
  });

  test('defaults to localhost on BACKEND_PORT when set', async () => {
    unsetBackendUrl();
    vi.stubEnv('BACKEND_PORT', '4321');
    const config = await importConfig();
    expect(config.backendUrl).toBe('http://localhost:4321');
  });

  test('uses BACKEND_URL when set', async () => {
    vi.stubEnv('BACKEND_URL', 'https://backend.example.com');
    const config = await importConfig();
    expect(config.backendUrl).toBe('https://backend.example.com');
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
    const reloadedConfig = await importConfig();
    expect(reloadedConfig.enableErrorStack).toBe(false);
  });

  test('defaults to isLocal() when ENABLE_ERROR_STACK is unset', async () => {
    vi.stubEnv('ENABLE_ERROR_STACK', undefined);
    vi.stubEnv('ENV', 'local');
    const config = await importConfig();
    expect(config.enableErrorStack).toBe(true);

    vi.stubEnv('ENV', 'staging');
    const reloadedConfig = await importConfig();
    expect(reloadedConfig.enableErrorStack).toBe(false);
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

describe('config.testRoutesEnabled', () => {
  test('is true when DISABLE_TEST_ROUTES is not set', async () => {
    vi.stubEnv('DISABLE_TEST_ROUTES', undefined);
    vi.stubEnv('VITE_DISABLE_TEST_ROUTES', undefined);
    const config = await importConfig();
    expect(config.testRoutesEnabled).toBe(true);
  });

  test('is false when DISABLE_TEST_ROUTES is true', async () => {
    vi.stubEnv('DISABLE_TEST_ROUTES', 'true');
    const config = await importConfig();
    expect(config.testRoutesEnabled).toBe(false);
  });
});
