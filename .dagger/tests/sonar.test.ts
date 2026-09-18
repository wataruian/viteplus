import { Secret, Socket } from '@dagger.io/dagger';
import { beforeEach, describe, expect, test } from 'vite-plus/test';

import { SONAR_WORKING_DIRECTORY } from '../src/helpers/constants';
import { localSonarRunner, remoteSonarRunner } from '../src/helpers/sonar';
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
    expect(reportTaskPath).toBe('/tmp/report-task.txt');
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
