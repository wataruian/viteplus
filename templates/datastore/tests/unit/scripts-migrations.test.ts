import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

const loadMigrations = async () => {
  const execFileSync = vi.fn();
  vi.doMock('node:child_process', () => ({ execFileSync }));
  const migrations = await import('../../src/scripts/migrations');
  return { execFileSync, migrations };
};

afterEach(() => {
  vi.doUnmock('node:child_process');
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('generateMigrations', () => {
  test('runs drizzle-kit generate for both dialects', async () => {
    const { execFileSync, migrations } = await loadMigrations();

    migrations.generateMigrations();

    expect(execFileSync.mock.calls).toStrictEqual(
      migrations.configs.map((config) => [
        migrations.drizzleKit,
        ['generate', '--config', config],
        { cwd: migrations.packageDir, stdio: 'inherit' },
      ]),
    );
  });

  test('names both migration folders', async () => {
    const { execFileSync, migrations } = await loadMigrations();

    migrations.generateMigrations('add_sample');

    for (const [, args] of execFileSync.mock.calls) {
      expect(args).toStrictEqual(expect.arrayContaining(['--name', 'add_sample']));
    }
    expect(execFileSync).toHaveBeenCalledTimes(2);
  });

  test('rejects a name drizzle-kit would mangle, before running anything', async () => {
    const { execFileSync, migrations } = await loadMigrations();

    expect(() => {
      migrations.generateMigrations('Add Sample');
    }).toThrow('invalid migration name "Add Sample"');
    expect(execFileSync).not.toHaveBeenCalled();
  });

  test('reads the name from the first CLI argument', async () => {
    const { migrations } = await loadMigrations();
    vi.spyOn(globalThis.process, 'argv', 'get').mockReturnValue(['node', 'generate', 'add_x']);

    expect(migrations.migrationNameArgument()).toBe('add_x');
  });
});
