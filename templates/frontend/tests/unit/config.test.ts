import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const importConfig = async () => {
  vi.resetModules();
  const { config } = await import('../../src/config');
  return config;
};

describe('config.frontendPort', () => {
  test('uses FRONTEND_PORT when set', async () => {
    vi.stubEnv('FRONTEND_PORT', '4000');
    vi.stubEnv('VITE_FRONTEND_PORT', undefined);
    const config = await importConfig();
    expect(config.frontendPort).toBe(4000);
  });

  test('rejects a non-integer FRONTEND_PORT value at load', async () => {
    vi.stubEnv('FRONTEND_PORT', '4000.9');
    vi.stubEnv('VITE_FRONTEND_PORT', undefined);
    await expect(importConfig()).rejects.toThrow(/FRONTEND_PORT/u);
  });

  test('falls back to VITE_FRONTEND_PORT when FRONTEND_PORT is unset', async () => {
    vi.stubEnv('FRONTEND_PORT', undefined);
    vi.stubEnv('VITE_FRONTEND_PORT', '5000');
    const config = await importConfig();
    expect(config.frontendPort).toBe(5000);
  });

  test('defaults to 2001 when neither FRONTEND_PORT nor VITE_FRONTEND_PORT is set', async () => {
    vi.stubEnv('FRONTEND_PORT', undefined);
    vi.stubEnv('VITE_FRONTEND_PORT', undefined);
    const config = await importConfig();
    expect(config.frontendPort).toBe(2001);
  });
});

describe('config.backendUrl', () => {
  test('uses BACKEND_URL when set', async () => {
    vi.stubEnv('BACKEND_URL', 'http://from-backend-url.test');
    vi.stubEnv('VITE_BACKEND_URL', undefined);
    const config = await importConfig();
    expect(config.backendUrl).toBe('http://from-backend-url.test');
  });

  test('falls back to VITE_BACKEND_URL when BACKEND_URL is unset', async () => {
    vi.stubEnv('BACKEND_URL', undefined);
    vi.stubEnv('VITE_BACKEND_URL', 'http://example.test');
    const config = await importConfig();
    expect(config.backendUrl).toBe('http://example.test');
  });

  test('falls back to the shared backendBaseUrl when neither BACKEND_URL nor VITE_BACKEND_URL is set', async () => {
    vi.stubEnv('BACKEND_URL', undefined);
    vi.stubEnv('VITE_BACKEND_URL', undefined);
    const config = await importConfig();
    expect(config.backendUrl).toBe('http://localhost:2000');
  });
});
