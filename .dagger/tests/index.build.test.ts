import { beforeEach, describe, expect, test } from 'vite-plus/test';

import { getLastContainer, resetLastContainer } from './helpers/dagger-fakes';
import { resetDaggerWorld, world } from './helpers/dagger-world';
import { seedMountFiles } from './helpers/fixtures';
import { createMonorepo } from './helpers/monorepo';

beforeEach(() => {
  resetDaggerWorld();
  resetLastContainer();
});

describe('build', () => {
  test('runs vp run -r build on the mounted workspace', async () => {
    seedMountFiles();

    const container = await createMonorepo().build('@lightproject/backend');

    expect(container).toBeDefined();
    expect(getLastContainer().capturedExecCalls).toContainEqual(['vp', 'run', '-r', 'build']);
  });

  test('applies buildEnv for a frontend workspace', async () => {
    seedMountFiles();

    await createMonorepo().build('@lightproject/frontend', ['VITE_ENV=production']);

    expect(getLastContainer().capturedEnvVariables.get('VITE_ENV')).toBe('production');
  });

  test('rejects when buildEnv is given for a non-frontend workspace', async () => {
    seedMountFiles();

    await expect(
      createMonorepo().build('@lightproject/backend', ['VITE_ENV=production']),
    ).rejects.toThrow(
      "buildEnv is only supported for frontend workspaces, got '@lightproject/backend'",
    );
  });
});

describe('buildArtifact', () => {
  test('prunes non-artifact files and returns the app directory', async () => {
    seedMountFiles();
    world.dirs.set('/app', ['dist/']);

    const result = await createMonorepo().buildArtifact('@lightproject/backend');

    const [pruneExec] = getLastContainer().capturedExecCalls.slice(-1);
    expect(pruneExec[0]).toBe('sh');
    expect(pruneExec[1]).toBe('-c');
    expect(pruneExec[2]).toContain('mindepth 1 -maxdepth 1');
    await expect(result.entries()).resolves.toStrictEqual(['dist/']);
  });
});

describe('test', () => {
  test('attaches the coverage report and row when coverage exists', async () => {
    seedMountFiles();
    world.execStdout = 'all tests passed';
    world.execExitCode = 0;
    world.dirs.set('/app/apps/backend/coverage', ['coverage-summary.json']);
    world.files.set(
      '/app/apps/backend/coverage/coverage-summary.json',
      JSON.stringify({
        total: {
          branches: { pct: 100 },
          functions: { pct: 100 },
          lines: { pct: 100 },
          statements: { pct: 100 },
        },
      }),
    );

    const result = await createMonorepo().test('@lightproject/backend');

    await expect(result.file('test.exit-code').contents()).resolves.toBe('0');
    await expect(result.file('test.output').contents()).resolves.toBe('all tests passed');
    await expect(result.directory('coverage').entries()).resolves.toStrictEqual([
      'coverage-summary.json',
    ]);
    await expect(result.file('test.row.md').contents()).resolves.toBe(
      '| backend | 100% | 100% | 100% | 100% |\n',
    );
  });

  test('renders the placeholder row when there is no coverage to attach', async () => {
    seedMountFiles();
    world.execStdout = 'no coverage configured';
    world.execExitCode = 1;

    const result = await createMonorepo().test('@lightproject/backend');

    await expect(result.file('test.exit-code').contents()).resolves.toBe('1');
    await expect(result.file('test.row.md').contents()).resolves.toBe(
      '| backend | _no coverage (tests failed or skipped)_ | | | |\n',
    );
  });

  test('runs vp run -r dagger:test and reads coverage from .dagger for the dagger workspace', async () => {
    world.execStdout = 'all dagger tests passed';
    world.execExitCode = 0;
    world.dirs.set('/app/.dagger/coverage', ['coverage-summary.json']);
    world.files.set(
      '/app/.dagger/coverage/coverage-summary.json',
      JSON.stringify({
        total: {
          branches: { pct: 100 },
          functions: { pct: 100 },
          lines: { pct: 100 },
          statements: { pct: 100 },
        },
      }),
    );

    const result = await createMonorepo().test('dagger');

    expect(getLastContainer().capturedExecCalls).toContainEqual(['vp', 'run', '-r', 'dagger:test']);
    await expect(result.file('test.exit-code').contents()).resolves.toBe('0');
    await expect(result.file('test.output').contents()).resolves.toBe('all dagger tests passed');
    await expect(result.directory('coverage').entries()).resolves.toStrictEqual([
      'coverage-summary.json',
    ]);
    await expect(result.file('test.row.md').contents()).resolves.toBe(
      '| dagger | 100% | 100% | 100% | 100% |\n',
    );
  });
});
