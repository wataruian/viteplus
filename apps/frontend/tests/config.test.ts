import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const importConfig = async () => {
  vi.resetModules();
  const { config } = await import('../src/config');
  return config;
};

describe('config.adminPort', () => {
  test('uses ADMIN_PORT when set', async () => {
    vi.stubEnv('ADMIN_PORT', '4000');
    vi.stubEnv('VITE_ADMIN_PORT', undefined);
    const config = await importConfig();
    expect(config.adminPort).toBe(4000);
  });

  test('truncates a non-integer ADMIN_PORT value', async () => {
    vi.stubEnv('ADMIN_PORT', '4000.9');
    vi.stubEnv('VITE_ADMIN_PORT', undefined);
    const config = await importConfig();
    expect(config.adminPort).toBe(4000);
  });

  test('falls back to VITE_ADMIN_PORT when ADMIN_PORT is unset', async () => {
    vi.stubEnv('ADMIN_PORT', undefined);
    vi.stubEnv('VITE_ADMIN_PORT', '5000');
    const config = await importConfig();
    expect(config.adminPort).toBe(5000);
  });

  test('defaults to 3001 when neither ADMIN_PORT nor VITE_ADMIN_PORT is set', async () => {
    vi.stubEnv('ADMIN_PORT', undefined);
    vi.stubEnv('VITE_ADMIN_PORT', undefined);
    const config = await importConfig();
    expect(config.adminPort).toBe(3001);
  });
});

describe('config.viteApiUrl', () => {
  test('uses API_URL when set', async () => {
    vi.stubEnv('API_URL', 'http://from-api-url.test');
    vi.stubEnv('VITE_API_URL', undefined);
    const config = await importConfig();
    expect(config.viteApiUrl).toBe('http://from-api-url.test');
  });

  test('falls back to VITE_API_URL when API_URL is unset', async () => {
    vi.stubEnv('API_URL', undefined);
    vi.stubEnv('VITE_API_URL', 'http://example.test');
    const config = await importConfig();
    expect(config.viteApiUrl).toBe('http://example.test');
  });

  test('falls back to the shared apiBaseUrl when neither API_URL nor VITE_API_URL is set', async () => {
    vi.stubEnv('API_URL', undefined);
    vi.stubEnv('VITE_API_URL', undefined);
    const config = await importConfig();
    expect(config.viteApiUrl).toBe('http://localhost:3000');
  });
});
