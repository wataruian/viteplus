import path from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import type * as wranglerModule from 'wrangler';

afterEach(() => {
  vi.doUnmock('wrangler');
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('migrateLocalD1', () => {
  test('migrates the shared local D1 state, then disposes the proxy', async () => {
    const actual = await vi.importActual<typeof wranglerModule>('wrangler');
    const options: Parameters<typeof actual.getPlatformProxy>[0][] = [];
    const dispose = vi.fn<() => Promise<void>>();
    vi.doMock('wrangler', () => ({
      getPlatformProxy: async (requested: Parameters<typeof actual.getPlatformProxy>[0]) => {
        options.push(requested);
        const proxy = await actual.getPlatformProxy({ ...requested, persist: false });
        dispose.mockImplementation(proxy.dispose);
        return { ...proxy, dispose };
      },
    }));
    const stdout = vi.spyOn(globalThis.process.stdout, 'write').mockReturnValue(true);
    const { migrateLocalD1, packageDir } = await import('../../src/scripts/migrate-d1-local');

    await migrateLocalD1();

    expect(options).toStrictEqual([
      {
        configPath: path.join(packageDir, 'wrangler.toml'),
        persist: { path: path.resolve(packageDir, '../../.wrangler/state/v3') },
      },
    ]);
    expect(stdout).toHaveBeenCalledWith('Local D1 is up to date\n');
    expect(dispose).toHaveBeenCalledOnce();
  });
});
