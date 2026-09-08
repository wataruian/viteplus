import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

vi.mock('../src/environment/meta-env', () => ({
  getMetaEnv: () => ({ ONLY_IN_META: 'from-import-meta-env' }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getEnv reading from import.meta.env', () => {
  test('falls back to import.meta.env when the key is absent from process.env', async () => {
    vi.stubEnv('ONLY_IN_META', undefined);
    vi.resetModules();
    const { getEnv } = await import('../src/environment/env');
    expect(getEnv('ONLY_IN_META')).toBe('from-import-meta-env');
  });
});
