import type * as ConfigsModule from '@lightproject/common/configs';
import { expect, test, vi } from 'vite-plus/test';

import type * as ConfigModule from '../../src/config';

const withBackendUrl = async (
  importOriginal: () => Promise<typeof ConfigModule>,
  backendUrl: string,
): Promise<typeof ConfigModule> => {
  const actual = await importOriginal();
  return { ...actual, config: { ...actual.config, backendUrl } };
};

vi.mock('@lightproject/common/configs', async (importOriginal) => {
  const actual = await importOriginal<typeof ConfigsModule>();
  return { ...actual, frontendUrl: '' };
});
vi.mock('../../src/config', async (importOriginal) => await withBackendUrl(importOriginal, ''));

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
      return { ...actual, frontendUrl: 'http://localhost:2001' };
    });
    vi.doMock(
      '../../src/config',
      async (importOriginal) => await withBackendUrl(importOriginal, 'https://backend.example.com'),
    );
    vi.stubEnv('ENV', env);
    vi.resetModules();

    const { uniqueOrigins } = await import('../../src/middlewares/security');

    expect(uniqueOrigins.includes('http://localhost:2001')).toBe(allowed);
    expect(uniqueOrigins).toContain('https://backend.example.com');
    vi.doUnmock('@lightproject/common/configs');
    vi.doUnmock('../../src/config');
    vi.unstubAllEnvs();
  },
);

test('isLoopbackOrigin treats an unparsable origin as non-loopback', async () => {
  vi.resetModules();
  const { isLoopbackOrigin } = await import('../../src/middlewares/security');

  expect(isLoopbackOrigin('not a url')).toBe(false);
  expect(isLoopbackOrigin('http://localhost:2000')).toBe(true);
});
