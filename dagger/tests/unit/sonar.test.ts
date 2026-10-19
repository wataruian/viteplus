import { Secret, Socket } from '@dagger.io/dagger';
import { beforeEach, describe, expect, test } from 'vite-plus/test';

import { SONAR_WORKING_DIRECTORY } from '../../src/helpers/constants';
import {
  LOCAL_ORCHESTRATOR_HOME,
  buildPollScript,
  localSonarRunner,
  remoteSonarRunner,
  sonarScope,
} from '../../src/helpers/sonar';
import { FakeDirectory } from './helpers/dagger-fakes';
import { resetDaggerWorld, world } from './helpers/dagger-world';

beforeEach(() => {
  resetDaggerWorld();
});

const fakeSocket = new Socket();
const fakeSecret = new Secret();

describe('localSonarRunner', () => {
  test('builds the docker-orchestrated scanner container and reports where report-task.txt lands', () => {
    const { container, reportTaskPath } = localSonarRunner(
      fakeSocket,
      new FakeDirectory(world),
      fakeSecret,
      'http://sonarqube:9000',
      '-Dsonar.projectKey=demo',
      'demo',
    );

    expect(container).toBeDefined();
    expect(reportTaskPath).toBe(`${LOCAL_ORCHESTRATOR_HOME}/report-task.txt`);
  });
});

describe('remoteSonarRunner', () => {
  test('builds the direct scanner container and reports where report-task.txt lands', () => {
    const { container, reportTaskPath } = remoteSonarRunner(
      new FakeDirectory(world),
      fakeSecret,
      'https://sonarcloud.io',
      '-Dsonar.projectKey=demo',
    );

    expect(container).toBeDefined();
    expect(reportTaskPath).toBe(`${SONAR_WORKING_DIRECTORY}/report-task.txt`);
  });
});

describe('sonarScope', () => {
  test('scans the main branch when neither a branch nor a pull request is given', () => {
    expect(sonarScope({})).toStrictEqual({ args: [], issuesQuery: '' });
  });

  test('scopes a branch scan and its issue search to that branch', () => {
    expect(sonarScope({ branch: 'feature/x.y_z-1' })).toStrictEqual({
      args: ['-Dsonar.branch.name=feature/x.y_z-1'],
      issuesQuery: '&branch=feature%2Fx.y_z-1',
    });
  });

  test('scopes a pull request scan and its issue search to that pull request', () => {
    expect(
      sonarScope({ pullRequest: '42', pullRequestBase: 'main', pullRequestBranch: 'ci' }),
    ).toStrictEqual({
      args: [
        '-Dsonar.pullrequest.key=42',
        '-Dsonar.pullrequest.branch=ci',
        '-Dsonar.pullrequest.base=main',
      ],
      issuesQuery: '&pullRequest=42',
    });
  });

  test.each([
    [{ branch: 'main', pullRequest: '1' }, 'pass either branch or pullRequest, not both'],
    [{ pullRequest: 'abc' }, 'pullRequest must be a pull request number'],
    [{ pullRequest: '1', pullRequestBase: 'main' }, 'pullRequestBranch must be a branch name'],
    [{ pullRequest: '1', pullRequestBranch: 'ci' }, 'pullRequestBase must be a branch name'],
    [{ pullRequestBranch: 'ci' }, 'pullRequestBranch and pullRequestBase need pullRequest'],
    [{ branch: 'x; rm -rf /' }, 'branch must be a branch name'],
    [{ branch: '' }, 'branch must be a branch name'],
  ])('rejects %o', (options, message) => {
    expect(() => sonarScope(options)).toThrow(message);
  });
});

describe('buildPollScript', () => {
  test('appends the scope to the issue search', () => {
    expect(buildPollScript('demo', '/out', '&pullRequest=7')).toContain(
      'componentKeys=demo&pullRequest=7&resolved=false',
    );
  });
});
