import type fsModule from 'node:fs';

import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import type * as migrationsModule from '../../src/scripts/migrations';
import { ExitError, stubProcessExit } from './helpers/process-exit';

interface Scenario {
  check?: () => void;
  existing?: string;
  formatted: string;
  generate?: () => void;
}

const runGenerate = async ({
  check = () => {},
  existing,
  formatted,
  generate = () => {},
}: Scenario) => {
  const actualFs = await vi.importActual<typeof fsModule>('node:fs');
  const generateMigrations = vi.fn(generate);
  const execFileSync = vi.fn(check);
  const written: string[] = [];
  const target = `${globalThis.process.cwd()}/src/d1/schema.ts`;
  const targetContents = () => (written.length > 0 ? formatted : (existing ?? ''));

  vi.doMock('node:child_process', () => ({ execFileSync }));
  vi.doMock('node:fs', () => ({
    default: {
      ...actualFs,
      existsSync: (file: string) =>
        file === target ? existing !== undefined : actualFs.existsSync(file),
      readFileSync: (file: string, encoding: BufferEncoding) =>
        file === target ? targetContents() : actualFs.readFileSync(file, encoding),
      writeFileSync: (file: string, contents: string) => {
        written.push(`${file}\n${contents}`);
      },
    },
  }));
  vi.doMock('../../src/scripts/migrations', async (importOriginal) => ({
    ...(await importOriginal<typeof migrationsModule>()),
    generateMigrations,
    migrationNameArgument: () => 'add_sample',
  }));
  const stdout = vi.spyOn(globalThis.process.stdout, 'write').mockReturnValue(true);
  const stderr = vi.spyOn(globalThis.process.stderr, 'write').mockReturnValue(true);
  stubProcessExit();

  const outcome = await import('../../src/scripts/generate').then(
    (paths) => ({ exitCode: undefined, paths }),
    (error: unknown) => ({
      exitCode: error instanceof ExitError ? error.code : 'not an exit',
      paths: undefined,
    }),
  );
  return { execFileSync, generateMigrations, outcome, stderr, stdout, target, written };
};

afterEach(() => {
  vi.doUnmock('node:child_process');
  vi.doUnmock('node:fs');
  vi.doUnmock('../../src/scripts/migrations');
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('db:generate', () => {
  test('writes the D1 schema, formats it with vp check, then generates both migrations', async () => {
    const run = await runGenerate({ formatted: 'new schema' });

    expect(run.written).toHaveLength(1);
    expect(run.written[0]).toContain(`${run.target}\n`);
    expect(run.written[0]).toContain("sqliteTable(\n  'users',");
    expect(run.execFileSync).toHaveBeenCalledWith(
      run.outcome.paths?.vp,
      ['check', '--fix', run.target],
      { encoding: 'utf8', stdio: 'pipe' },
    );
    expect(run.stdout).toHaveBeenCalledWith(
      'D1 schema updated from the Postgres schema (src/d1/schema.ts)\n',
    );
    expect(run.generateMigrations).toHaveBeenCalledExactlyOnceWith('add_sample');
    expect(run.outcome.exitCode).toBeUndefined();
  });

  test('reports when the D1 schema was already in sync', async () => {
    const run = await runGenerate({ existing: 'same', formatted: 'same' });

    expect(run.stdout).toHaveBeenCalledWith('D1 schema already in sync with the Postgres schema\n');
  });

  test('fails with vp check output when the generated schema does not pass', async () => {
    const run = await runGenerate({
      check: () => {
        throw Object.assign(new Error('exit 1'), { stderr: 'ERR', stdout: 'OUT' });
      },
      formatted: '',
    });

    expect(run.stderr).toHaveBeenCalledWith(
      'db:generate failed: generated src/d1/schema.ts does not pass `vp check`:\nOUTERR\n',
    );
    expect(run.generateMigrations).not.toHaveBeenCalled();
    expect(run.outcome.exitCode).toBe(1);
  });

  test('fails without output when vp check throws without capturing it', async () => {
    const run = await runGenerate({
      check: () => {
        throw new Error('spawn failed');
      },
      formatted: '',
    });

    expect(run.stderr).toHaveBeenCalledWith(
      'db:generate failed: generated src/d1/schema.ts does not pass `vp check`:\n\n',
    );
  });

  test('reports a failure that is not an Error instance', async () => {
    const notAnError: Error = { message: 'boom', name: 'Plain' };
    const run = await runGenerate({
      formatted: 'x',
      generate: () => {
        throw notAnError;
      },
    });

    expect(run.stderr).toHaveBeenCalledWith(
      'db:generate failed: {"message":"boom","name":"Plain"}\n',
    );
    expect(run.outcome.exitCode).toBe(1);
  });
});
