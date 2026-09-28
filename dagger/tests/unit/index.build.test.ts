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
    for (const kept of ['dist', 'package.json', 'tsconfig.json', 'tsconfig.pack.json']) {
      expect(pruneExec[2]).toContain(`! -name '${kept}'`);
    }
    await expect(result.entries()).resolves.toStrictEqual(['dist/']);
  });
});

describe('testUnit', () => {
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

    const result = await createMonorepo().testUnit('@lightproject/backend');

    await expect(result.file('test-unit.exit-code').contents()).resolves.toBe('0');
    await expect(result.file('test-unit.output').contents()).resolves.toBe('all tests passed');
    await expect(result.directory('coverage').entries()).resolves.toStrictEqual([
      'coverage-summary.json',
    ]);
    await expect(result.file('test-unit.row.md').contents()).resolves.toBe(
      '| backend | 100% | 100% | 100% | 100% |\n',
    );
  });

  test('renders the placeholder row when there is no coverage to attach', async () => {
    seedMountFiles();
    world.execStdout = 'no coverage configured';
    world.execExitCode = 1;

    const result = await createMonorepo().testUnit('@lightproject/backend');

    await expect(result.file('test-unit.exit-code').contents()).resolves.toBe('1');
    await expect(result.file('test-unit.row.md').contents()).resolves.toBe(
      '| backend | _no coverage (tests failed or skipped)_ | | | |\n',
    );
  });

  test('runs vp run -r dagger:test:unit and reads coverage from dagger for the dagger workspace', async () => {
    world.execStdout = 'all dagger tests passed';
    world.execExitCode = 0;
    world.dirs.set('/app/dagger/coverage', ['coverage-summary.json']);
    world.files.set(
      '/app/dagger/coverage/coverage-summary.json',
      JSON.stringify({
        total: {
          branches: { pct: 100 },
          functions: { pct: 100 },
          lines: { pct: 100 },
          statements: { pct: 100 },
        },
      }),
    );

    const result = await createMonorepo().testUnit('dagger');

    expect(getLastContainer().capturedExecCalls).toContainEqual([
      'vp',
      'run',
      '-r',
      'dagger:test:unit',
    ]);
    await expect(result.file('test-unit.exit-code').contents()).resolves.toBe('0');
    await expect(result.file('test-unit.output').contents()).resolves.toBe(
      'all dagger tests passed',
    );
    await expect(result.directory('coverage').entries()).resolves.toStrictEqual([
      'coverage-summary.json',
    ]);
    await expect(result.file('test-unit.row.md').contents()).resolves.toBe(
      '| dagger | 100% | 100% | 100% | 100% |\n',
    );
  });
});

describe('testEndToEnd', () => {
  const e2eDir = '/app/apps/frontend/tmp/e2e';

  test('runs test:e2e with Chromium installed and attaches the Playwright output and row', async () => {
    seedMountFiles();
    world.dirs.set('apps/frontend', ['playwright.config.ts', 'package.json']);
    world.execStdout = '1 passed';
    world.execExitCode = 0;
    world.dirs.set(e2eDir, ['results.json', 'report/', 'results/']);
    world.files.set(
      `${e2eDir}/results.json`,
      JSON.stringify({
        stats: { duration: 5390.66, expected: 1, flaky: 0, skipped: 0, unexpected: 0 },
      }),
    );

    const result = await createMonorepo().testEndToEnd('@lightproject/frontend');

    const container = getLastContainer();
    expect(container.capturedUsers).toStrictEqual(['root', 'vp']);
    expect(container.capturedExecCalls).toContainEqual([
      'vp',
      'run',
      '--filter',
      '@lightproject/frontend',
      'test:e2e',
    ]);
    await expect(result.file('test-end-to-end.exit-code').contents()).resolves.toBe('0');
    await expect(result.file('test-end-to-end.output').contents()).resolves.toBe('1 passed');
    await expect(result.directory('e2e').entries()).resolves.toStrictEqual([
      'results.json',
      'report/',
      'results/',
    ]);
    await expect(result.file('test-end-to-end.row.md').contents()).resolves.toBe(
      '| frontend | ✅ Passed | 1 | 0 | 0 | 0 | 5.4s |\n',
    );
  });

  test('renders the placeholder row when Playwright produced no output', async () => {
    seedMountFiles();
    world.dirs.set('apps/frontend', ['playwright.config.ts']);
    world.execStdout = 'web server failed to start';
    world.execExitCode = 1;

    const result = await createMonorepo().testEndToEnd('@lightproject/frontend');

    await expect(result.file('test-end-to-end.exit-code').contents()).resolves.toBe('1');
    await expect(result.file('test-end-to-end.row.md').contents()).resolves.toBe(
      '| frontend | _no report (tests failed to start or were skipped)_ | | | | | |\n',
    );
  });

  test('rejects a workspace without Playwright e2e tests', async () => {
    seedMountFiles();
    world.dirs.set('packages/library', ['package.json', 'src/']);

    await expect(createMonorepo().testEndToEnd('@lightproject/library')).rejects.toThrow(
      'Workspace @lightproject/library has no Playwright e2e tests (playwright.config.ts)',
    );
  });
});
