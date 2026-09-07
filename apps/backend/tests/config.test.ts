import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { config } from '../src/config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('config.apiPort', () => {
  test('defaults to 3000 when API_PORT is not set', () => {
    vi.stubEnv('API_PORT', undefined);
    expect(config.apiPort).toBe(3000);
  });

  test('uses API_PORT when set', () => {
    vi.stubEnv('API_PORT', '4321');
    expect(config.apiPort).toBe(4321);
  });
});

describe('config.enableErrorStack', () => {
  test('is false in production regardless of ENABLE_ERROR_STACK', () => {
    vi.stubEnv('ENV', 'production');
    vi.stubEnv('ENABLE_ERROR_STACK', 'true');
    expect(config.enableErrorStack).toBe(false);
  });

  test('uses the explicit ENABLE_ERROR_STACK value outside production', () => {
    vi.stubEnv('ENV', 'staging');
    vi.stubEnv('ENABLE_ERROR_STACK', 'true');
    expect(config.enableErrorStack).toBe(true);

    vi.stubEnv('ENABLE_ERROR_STACK', 'false');
    expect(config.enableErrorStack).toBe(false);
  });

  test('defaults to isLocal() when ENABLE_ERROR_STACK is unset', () => {
    vi.stubEnv('ENABLE_ERROR_STACK', undefined);

    vi.stubEnv('ENV', 'local');
    expect(config.enableErrorStack).toBe(true);

    vi.stubEnv('ENV', 'staging');
    expect(config.enableErrorStack).toBe(false);
  });
});

describe('config.skipOpenTelemetry', () => {
  test('defaults to false', () => {
    vi.stubEnv('SKIP_OPENTELEMETRY', undefined);
    expect(config.skipOpenTelemetry).toBe(false);
  });

  test('is true when SKIP_OPENTELEMETRY=true', () => {
    vi.stubEnv('SKIP_OPENTELEMETRY', 'true');
    expect(config.skipOpenTelemetry).toBe(true);
  });
});
