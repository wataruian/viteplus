import type * as ConfigsModule from '@lightproject/common/configs';
import { expect, test, vi } from 'vite-plus/test';

vi.mock('@lightproject/common/configs', async (importOriginal) => {
  const actual = await importOriginal<typeof ConfigsModule>();
  return { ...actual, adminUrl: '', apiBaseUrl: '', siteUrl: '' };
});

test('no default API/admin/site URL configured leaves the origin allowlist empty', async () => {
  vi.resetModules();
  const { allowedOrigins, uniqueOrigins } = await import('../src/middlewares/security');

  expect(allowedOrigins).toStrictEqual([]);
  expect(uniqueOrigins).toStrictEqual([]);
});
