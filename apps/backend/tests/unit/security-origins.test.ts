import type * as ConfigsModule from '@lightproject/common/configs';
import { expect, test, vi } from 'vite-plus/test';

vi.mock('@lightproject/common/configs', async (importOriginal) => {
  const actual = await importOriginal<typeof ConfigsModule>();
  return { ...actual, backendBaseUrl: '', frontendUrl: '' };
});

const baselineOrigins: string[] = [];

test('no default backend/frontend URL configured leaves only the baseline workers.dev origins', async () => {
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
  'localhost backend/frontend URLs are trusted only locally/in tests (ENV=$env)',
  async ({ allowed, env }) => {
    vi.doMock('@lightproject/common/configs', async (importOriginal) => {
      const actual = await importOriginal<typeof ConfigsModule>();
      return {
        ...actual,
        backendBaseUrl: 'https://backend.example.com',
        frontendUrl: 'http://localhost:2001',
      };
    });
    vi.stubEnv('ENV', env);
    vi.resetModules();

    const { uniqueOrigins } = await import('../../src/middlewares/security');

    expect(uniqueOrigins.includes('http://localhost:2001')).toBe(allowed);
    expect(uniqueOrigins).toContain('https://backend.example.com');
    vi.doUnmock('@lightproject/common/configs');
    vi.unstubAllEnvs();
  },
);

test('isLoopbackOrigin treats an unparsable origin as non-loopback', async () => {
  vi.resetModules();
  const { isLoopbackOrigin } = await import('../../src/middlewares/security');

  expect(isLoopbackOrigin('not a url')).toBe(false);
  expect(isLoopbackOrigin('http://localhost:2000')).toBe(true);
});
