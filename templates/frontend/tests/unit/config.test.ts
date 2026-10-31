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
