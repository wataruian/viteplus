import { Secret, Socket } from '@dagger.io/dagger';
import { beforeEach, describe, expect, test } from 'vite-plus/test';

import { SONAR_WORKING_DIRECTORY } from '../../src/helpers/constants';
import { LOCAL_ORCHESTRATOR_HOME, POLL_CONTAINER_HOME } from '../../src/helpers/sonar';
import { getLastContainer, resetLastContainer } from './helpers/dagger-fakes';
import { resetDaggerWorld, world } from './helpers/dagger-world';
import { seedMountFiles, seedWorkspaceDirs } from './helpers/fixtures';
import { createMonorepo } from './helpers/monorepo';

beforeEach(() => {
  resetDaggerWorld();
  resetLastContainer();
});

const fakeSocket = new Socket();
const fakeSecret = new Secret();

describe('semgrep', () => {
  test('attaches the SARIF report and row when the scan finds something', async () => {
    world.execStdout = 'scan output';
    world.execExitCode = 1;
    world.files.set(
      '/repo/semgrep.sarif',
      JSON.stringify({
        runs: [
          {
            results: [
              {
                locations: [
                  {
                    physicalLocation: {
                      artifactLocation: { uri: 'src/app.ts' },
                      region: { startLine: 5 },
                    },
                  },
                ],
                message: { text: 'Avoid eval' },
                ruleId: 'no-eval',
              },
            ],
          },
        ],
      }),
    );

    const result = await createMonorepo().semgrep('@lightproject/backend');

    await expect(result.file('semgrep.exit-code').contents()).resolves.toBe('1');
    await expect(result.file('semgrep.sarif').contents()).resolves.toContain('no-eval');
    await expect(result.file('semgrep.row.md').contents()).resolves.toBe(
      '| backend | 1 | `no-eval` src/app.ts:5 — Avoid eval |\n',
    );
  });

  test('renders the placeholder row when there is no SARIF report to attach', async () => {
    world.execStdout = 'clean scan';
    world.execExitCode = 0;

    const result = await createMonorepo().semgrep('@lightproject/backend');

    await expect(result.file('semgrep.exit-code').contents()).resolves.toBe('0');
    await expect(result.file('semgrep.row.md').contents()).resolves.toBe(
      '| backend | _no report (scan failed or skipped)_ | |\n',
    );
  });

  test('scans the dagger directory for the dagger workspace', async () => {
    world.execStdout = 'clean scan';
    world.execExitCode = 0;

    const result = await createMonorepo().semgrep('dagger');

    await expect(result.file('semgrep.exit-code').contents()).resolves.toBe('0');
    await expect(result.file('semgrep.row.md').contents()).resolves.toBe(
      '| dagger | _no report (scan failed or skipped)_ | |\n',
    );
  });
});

describe('sonar', () => {
  test('rejects when the local target is used without a docker socket', async () => {
    await expect(createMonorepo().sonar('@lightproject/backend', fakeSecret)).rejects.toThrow(
      'dockerSocket is required for the local SonarQube target',
    );
  });

  test('runs the local scanner, attaching coverage and both report files when present', async () => {
    seedMountFiles();
    world.execStdout = 'local scan output';
    world.execExitCode = 0;
    world.dirs.set('/app/templates/backend/coverage', ['coverage-summary.json']);
    world.files.set(
      '/app/templates/backend/coverage/coverage-summary.json',
      JSON.stringify({
        total: {
          branches: { pct: 90 },
          functions: { pct: 90 },
          lines: { pct: 90 },
          statements: { pct: 90 },
        },
      }),
    );
    world.files.set(`${LOCAL_ORCHESTRATOR_HOME}/sonar.exit-code`, '0');
    world.files.set(
      `${LOCAL_ORCHESTRATOR_HOME}/sonar-quality-gate.json`,
      JSON.stringify({ projectStatus: { conditions: [], status: 'OK' } }),
    );
    world.files.set(`${LOCAL_ORCHESTRATOR_HOME}/sonar-issues.json`, JSON.stringify({ issues: [] }));

    const result = await createMonorepo().sonar('@lightproject/backend', fakeSecret, fakeSocket);

    await expect(result.file('sonar.exit-code').contents()).resolves.toBe('0');
    await expect(result.file('sonar.row.md').contents()).resolves.toBe(
      '| backend | ✅ Passed | - | - | - | - |\n',
    );
  });

  test('runs the local scanner and falls back cleanly when coverage and report files are missing', async () => {
    seedMountFiles();
    world.execStdout = 'local scan output';
    world.execExitCode = 1;
    world.files.set(`${LOCAL_ORCHESTRATOR_HOME}/sonar.exit-code`, '1');

    const result = await createMonorepo().sonar('@lightproject/backend', fakeSecret, fakeSocket);

    await expect(result.file('sonar.exit-code').contents()).resolves.toBe('1');
    await expect(result.file('sonar.row.md').contents()).resolves.toBe(
      '| backend | _no report (scan failed or skipped)_ | | | | |\n',
    );
  });

  test('polls the remote task and attaches whichever report files land', async () => {
    seedMountFiles();
    world.execStdout = 'remote scan output';
    world.execExitCode = 0;
    world.files.set('/usr/src/sonar.exit-code', '0');
    world.files.set(`${SONAR_WORKING_DIRECTORY}/report-task.txt`, 'ceTaskId=AB-123\nother=stuff');
    world.files.set(
      `${POLL_CONTAINER_HOME}/sonar-quality-gate.json`,
      JSON.stringify({ projectStatus: { conditions: [], status: 'OK' } }),
    );

    const result = await createMonorepo().sonar(
      '@lightproject/backend',
      fakeSecret,
      undefined,
      'https://sonarcloud.io',
    );

    await expect(result.file('sonar.row.md').contents()).resolves.toBe(
      '| backend | ✅ Passed | - | - | - | - |\n',
    );
  });

  test('skips polling when the scanner never produced a report-task.txt', async () => {
    seedMountFiles();
    world.execStdout = 'remote scan output';
    world.execExitCode = 1;
    world.files.set('/usr/src/sonar.exit-code', '1');

    const result = await createMonorepo().sonar(
      '@lightproject/backend',
      fakeSecret,
      undefined,
      'https://sonarcloud.io',
    );

    await expect(result.file('sonar.row.md').contents()).resolves.toBe(
      '| backend | _no report (scan failed or skipped)_ | | | | |\n',
    );
  });

  test('skips polling when report-task.txt has no ceTaskId', async () => {
    seedMountFiles();
    world.execStdout = 'remote scan output';
    world.execExitCode = 1;
    world.files.set('/usr/src/sonar.exit-code', '1');
    world.files.set(`${SONAR_WORKING_DIRECTORY}/report-task.txt`, 'no task id here');

    const result = await createMonorepo().sonar(
      '@lightproject/backend',
      fakeSecret,
      undefined,
      'https://sonarcloud.io',
    );

    await expect(result.file('sonar.row.md').contents()).resolves.toBe(
      '| backend | _no report (scan failed or skipped)_ | | | | |\n',
    );
  });

  test('scans a pull request into its own project', async () => {
    seedMountFiles();
    world.execExitCode = 0;
    world.files.set('/usr/src/sonar.exit-code', '0');

    await createMonorepo().sonar(
      '@lightproject/backend',
      fakeSecret,
      undefined,
      'https://sonarcloud.io',
      undefined,
      '42',
    );

    expect(getLastContainer().capturedExecCalls.at(-1)?.[2]).toContain(
      "-Dsonar.projectKey=lightproject-viteplus-backend-pr-42 -Dsonar.projectName='Vite+ Monorepo - backend (PR #42)'",
    );
  });

  test('rejects an unsafe branch name before scanning', async () => {
    await expect(
      createMonorepo().sonar('@lightproject/backend', fakeSecret, fakeSocket, undefined, 'a b'),
    ).rejects.toThrow('branch must be a branch name');
  });

  test('runs the local scanner for the dagger workspace, attaching coverage from dagger', async () => {
    world.execStdout = 'local scan output';
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
    world.files.set(`${LOCAL_ORCHESTRATOR_HOME}/sonar.exit-code`, '0');
    world.files.set(
      `${LOCAL_ORCHESTRATOR_HOME}/sonar-quality-gate.json`,
      JSON.stringify({ projectStatus: { conditions: [], status: 'OK' } }),
    );
    world.files.set(`${LOCAL_ORCHESTRATOR_HOME}/sonar-issues.json`, JSON.stringify({ issues: [] }));

    const result = await createMonorepo().sonar('dagger', fakeSecret, fakeSocket);

    await expect(result.file('sonar.exit-code').contents()).resolves.toBe('0');
    await expect(result.file('sonar.row.md').contents()).resolves.toBe(
      '| dagger | ✅ Passed | - | - | - | - |\n',
    );
  });
});

describe('sonarCleanup', () => {
  test('deletes the pull request project of every workspace', async () => {
    seedWorkspaceDirs();
    world.execStdout = 'deleted lightproject-viteplus-backend-pr-42';

    await expect(
      createMonorepo().sonarCleanup('42', fakeSecret, undefined, 'https://sonarcloud.io'),
    ).resolves.toBe('deleted lightproject-viteplus-backend-pr-42');
    const script = getLastContainer().capturedExecCalls.at(-1)?.[2];
    for (const name of [
      'backend',
      'common',
      'datastore',
      'design-system',
      'frontend',
      'library',
      'scheduler',
      'tasks',
      'dagger',
    ]) {
      expect(script).toContain(`lightproject-viteplus-${name}-pr-42`);
    }
    expect(script).not.toContain('README');
  });

  test('runs through the docker socket for the local instance', async () => {
    seedWorkspaceDirs();
    await createMonorepo().sonarCleanup('42', fakeSecret, fakeSocket);

    expect(getLastContainer().capturedExecCalls.at(-1)?.[2]).toContain('docker run --rm -i');
  });

  test('requires the docker socket for the local instance', async () => {
    await expect(createMonorepo().sonarCleanup('42', fakeSecret)).rejects.toThrow(
      'dockerSocket is required',
    );
  });

  test('rejects a pull request that is not a number', async () => {
    seedWorkspaceDirs();
    await expect(
      createMonorepo().sonarCleanup('1; rm -rf /', fakeSecret, fakeSocket),
    ).rejects.toThrow('pullRequest must be a pull request number');
  });
});
