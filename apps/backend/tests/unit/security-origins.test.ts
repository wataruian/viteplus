import type * as ConfigsModule from '@lightproject/common/configs';
import { expect, test, vi } from 'vite-plus/test';

vi.mock('@lightproject/common/configs', async (importOriginal) => {
  const actual = await importOriginal<typeof ConfigsModule>();
  return { ...actual, adminUrl: '', apiBaseUrl: '', siteUrl: '' };
});

const baselineOrigins: string[] = [];

test('no default API/admin/site URL configured leaves only the baseline workers.dev origins', async () => {
  vi.resetModules();
  const { allowedOrigins, uniqueOrigins } = await import('../../src/middlewares/security');

  expect(allowedOrigins).toStrictEqual(baselineOrigins);
  expect(uniqueOrigins).toStrictEqual(baselineOrigins);
});

test.each([
  { allowed: false, env: 'production' },
  { allowed: true, env: 'local' },
  { allowed: true, env: 'test' },
])(
  'localhost API/admin/site URLs are trusted only locally/in tests (ENV=$env)',
  async ({ allowed, env }) => {
    vi.doMock('@lightproject/common/configs', async (importOriginal) => {
      const actual = await importOriginal<typeof ConfigsModule>();
      return {
        ...actual,
        adminUrl: 'http://localhost:3001',
        apiBaseUrl: 'https://api.example.com',
        siteUrl: 'not a url',
      };
    });
    vi.stubEnv('ENV', env);
    vi.resetModules();

    const { uniqueOrigins } = await import('../../src/middlewares/security');

    expect(uniqueOrigins.includes('http://localhost:3001')).toBe(allowed);
    expect(uniqueOrigins).toContain('https://api.example.com');
    vi.doUnmock('@lightproject/common/configs');
    vi.unstubAllEnvs();
  },
);
