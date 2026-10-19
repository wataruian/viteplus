import { Secret, Socket } from '@dagger.io/dagger';
import { beforeEach, describe, expect, test } from 'vite-plus/test';

import { SONAR_LOCAL_DOCKER_NETWORK, SONAR_WORKING_DIRECTORY } from '../../src/helpers/constants';
import {
  LOCAL_ORCHESTRATOR_HOME,
  buildDeleteScript,
  localSonarRunner,
  remoteSonarRunner,
  sonarCleanupRunner,
  sonarProject,
} from '../../src/helpers/sonar';
import { FakeDirectory, getLastContainer } from './helpers/dagger-fakes';
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

describe('sonarProject', () => {
  test('uses the base project when neither a branch nor a pull request is given', () => {
    expect(sonarProject('backend', {})).toStrictEqual({
      key: 'lightproject-viteplus-backend',
      name: 'Vite+ Monorepo - backend',
    });
  });

  test('gives each pull request its own project', () => {
    expect(sonarProject('backend', { pullRequest: '42' })).toStrictEqual({
      key: 'lightproject-viteplus-backend-pr-42',
      name: 'Vite+ Monorepo - backend (PR #42)',
    });
  });

  test('gives each branch its own project, with slashes turned into dashes in the key', () => {
    expect(sonarProject('backend', { branch: 'feature/x.y_z-1' })).toStrictEqual({
      key: 'lightproject-viteplus-backend-feature-x.y_z-1',
      name: 'Vite+ Monorepo - backend (feature/x.y_z-1)',
    });
  });

  test.each([
    [{ branch: 'main', pullRequest: '1' }, 'pass either branch or pullRequest, not both'],
    [{ pullRequest: 'abc' }, 'pullRequest must be a pull request number'],
    [{ pullRequest: '' }, 'pullRequest must be a pull request number'],
    [{ branch: "x'; rm -rf /" }, 'branch must be a branch name'],
    [{ branch: '' }, 'branch must be a branch name'],
  ])('rejects %o', (options, message) => {
    expect(() => sonarProject('backend', options)).toThrow(message);
  });
});

describe('buildDeleteScript', () => {
  test('deletes every key and treats a missing project as success', () => {
    const script = buildDeleteScript(['a-pr-1', 'b-pr-1']);

    expect(script).toContain('for key in a-pr-1 b-pr-1; do');
    expect(script).toContain('/api/projects/delete?project=$key');
    expect(script).toContain('404) echo "not found $key" ;;');
  });
});

describe('sonarCleanupRunner', () => {
  test('calls a remote instance directly', () => {
    sonarCleanupRunner(['a-pr-1'], fakeSecret, 'https://sonarcloud.io');

    expect(getLastContainer().capturedExecCalls.at(-1)?.[2]).toBe(buildDeleteScript(['a-pr-1']));
  });

  test('reaches the local instance through the compose network', () => {
    sonarCleanupRunner(['a-pr-1'], fakeSecret, 'http://sonarqube:9000', fakeSocket);

    expect(getLastContainer().capturedExecCalls.at(-1)?.[2]).toContain(
      `docker run --rm -i --network ${SONAR_LOCAL_DOCKER_NETWORK}`,
    );
  });
});
