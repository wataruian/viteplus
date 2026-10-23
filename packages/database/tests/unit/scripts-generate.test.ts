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
  const targets = ['schema.ts', 'crud.ts', 'tables.ts', 'worker-jobs.ts'].map(
    (file) => `${globalThis.process.cwd()}/src/d1/${file}`,
  );
  const isTarget = (file: string) => targets.includes(file);
  const targetContents = (file: string) =>
    written.some((entry) => entry.startsWith(`${file}\n`)) ? formatted : (existing ?? '');

  vi.doMock('node:child_process', () => ({ execFileSync }));
  vi.doMock('node:fs', () => ({
    default: {
      ...actualFs,
      existsSync: (file: string) =>
        isTarget(file) ? existing !== undefined : actualFs.existsSync(file),
      readFileSync: (file: string, encoding: BufferEncoding) =>
        isTarget(file) ? targetContents(file) : actualFs.readFileSync(file, encoding),
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
  return { execFileSync, generateMigrations, outcome, stderr, stdout, targets, written };
};

afterEach(() => {
  vi.doUnmock('node:child_process');
  vi.doUnmock('node:fs');
  vi.doUnmock('../../src/scripts/migrations');
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('db:generate', () => {
  test('writes every D1 file, formats each with vp check, then generates both migrations', async () => {
    const run = await runGenerate({ formatted: 'new contents' });

    expect(run.written.map((entry) => entry.split('\n')[0])).toStrictEqual(run.targets);
    expect(run.written[0]).toContain("sqliteTable(\n  'users',");
    expect(run.written[1]).toContain('const createD1Crud =');
    expect(run.written[2]).toContain('const createD1Tables = (db: D1Database): Tables');
    expect(run.written[3]).toContain('const createD1WorkerJobQueue = (db: D1Database)');
    for (const target of run.targets) {
      expect(run.execFileSync).toHaveBeenCalledWith(
        run.outcome.paths?.vp,
        ['check', '--fix', target],
        { encoding: 'utf8', stdio: 'pipe' },
      );
    }
    expect(run.stdout.mock.calls).toStrictEqual([
      ['src/d1/schema.ts updated from src/postgres/schema.ts\n'],
      ['src/d1/crud.ts updated from src/postgres/crud.ts\n'],
      ['src/d1/tables.ts updated from src/postgres/tables.ts\n'],
      ['src/d1/worker-jobs.ts updated from src/postgres/worker-jobs.ts\n'],
    ]);
    expect(run.generateMigrations).toHaveBeenCalledExactlyOnceWith('add_sample');
    expect(run.outcome.exitCode).toBeUndefined();
  });

  test('reports the D1 files that were already in sync', async () => {
    const run = await runGenerate({ existing: 'same', formatted: 'same' });

    expect(run.stdout).toHaveBeenCalledWith(
      'src/d1/worker-jobs.ts already in sync with src/postgres/worker-jobs.ts\n',
    );
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
