import type * as ConfigsModule from '@lightproject/common/configs';
import { expect, test, vi } from 'vite-plus/test';

vi.mock('@lightproject/common/configs', async (importOriginal) => {
  const actual = await importOriginal<typeof ConfigsModule>();
  return { ...actual, adminUrl: '', apiBaseUrl: '', siteUrl: '' };
});

const baselineOrigins: string[] = [
  // 'https://lightproject-backend.wataru.workers.dev',
  // 'https://lightproject-frontend.wataru.workers.dev',
  // 'https://lightproject-design-system.wataru.workers.dev',
  // 'https://lightproject-storybook.wataru.workers.dev',
  // 'https://lightproject-admin.wataru.workers.dev',
  // 'https://lightproject-site.wataru.workers.dev',
];

test('no default API/admin/site URL configured leaves only the baseline workers.dev origins', async () => {
  vi.resetModules();
  const { allowedOrigins, uniqueOrigins } = await import('../src/middlewares/security');

  expect(allowedOrigins).toStrictEqual(baselineOrigins);
  expect(uniqueOrigins).toStrictEqual(baselineOrigins);
});
