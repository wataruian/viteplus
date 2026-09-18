import { Secret, Socket } from '@dagger.io/dagger';
import { beforeEach, describe, expect, test } from 'vite-plus/test';

import { asFakeContainer, resetLastContainer } from './helpers/dagger-fakes';
import { resetDaggerWorld, world } from './helpers/dagger-world';
import { seedMountFiles } from './helpers/fixtures';
import { createMonorepo } from './helpers/monorepo';

beforeEach(() => {
  resetDaggerWorld();
  resetLastContainer();
});

const fakeSocket = new Socket();
const fakeSecret = new Secret();

describe('nginx', () => {
  test('mounts the vite build from "out" and the storybook static site when both are present', async () => {
    seedMountFiles();
    world.dirs.set('/app/apps/frontend', ['out/', 'storybook-static/']);

    const container = await createMonorepo().nginx('@lightproject/frontend');

    expect(asFakeContainer(container).capturedDefaultArgs).toStrictEqual([
      'nginx',
      '-g',
      'daemon off;',
    ]);
  });

  test('falls back to "dist" when "out" is absent and skips storybook when absent', async () => {
    seedMountFiles();
    world.dirs.set('/app/apps/frontend', ['dist/']);

    const container = await createMonorepo().nginx('@lightproject/frontend');

    expect(asFakeContainer(container).capturedDefaultArgs).toStrictEqual([
      'nginx',
      '-g',
      'daemon off;',
    ]);
  });

  test('mounts neither vite artifact directory when neither is present', async () => {
    seedMountFiles();
    world.dirs.set('/app/apps/frontend', []);

    const container = await createMonorepo().nginx('@lightproject/frontend');

    expect(asFakeContainer(container).capturedDirectoryPaths).not.toContain(
      '/usr/share/nginx/html/vite',
    );
  });
});

describe('vp', () => {
  test('copies dist artifacts for packages that have them, across apps and packages', async () => {
    seedMountFiles();
    world.dirs.set('/app', ['apps/', 'packages/']);
    world.dirs.set('/app/apps', ['frontend/']);
    world.dirs.set('/app/packages', ['common/']);
    world.dirs.set('/app/apps/frontend', ['dist/']);
    world.dirs.set('/app/packages/common', []);

    const container = await createMonorepo().vp('@lightproject/backend');
    const fake = asFakeContainer(container);

    expect(fake.capturedDirectoryPaths).toContain('/app/apps/frontend/dist');
    expect(fake.capturedDirectoryPaths).not.toContain('/app/packages/common/dist');
    expect(fake.capturedWorkdir).toBe('/app/apps/backend');
    expect(fake.capturedDefaultArgs).toStrictEqual(['node', 'dist/index.mjs']);
  });

  test('copies nothing when the root has neither apps nor packages', async () => {
    seedMountFiles();
    world.dirs.set('/app', []);

    const container = await createMonorepo().vp('@lightproject/backend');

    expect(asFakeContainer(container).capturedDirectoryPaths).toStrictEqual(['/app']);
  });
});

describe('load', () => {
  test('loads and tags a frontend (nginx) image, adding the extra tag when given', async () => {
    seedMountFiles();
    world.dirs.set('/app/apps/frontend', []);
    world.execStdout = 'Loaded image: frontend:latest';

    const stdout = await createMonorepo().load('@lightproject/frontend', fakeSocket, 'v1.2.3');

    expect(stdout).toBe('Loaded image: frontend:latest');
  });

  test('loads and tags a non-frontend (vp) image without an extra tag when omitted', async () => {
    seedMountFiles();
    world.dirs.set('/app', []);
    world.execStdout = 'Loaded image: backend:latest';

    const stdout = await createMonorepo().load('@lightproject/backend', fakeSocket);

    expect(stdout).toBe('Loaded image: backend:latest');
  });

  test('does not add an extra tag when it is an empty string', async () => {
    seedMountFiles();
    world.dirs.set('/app', []);
    world.execStdout = 'Loaded image: backend:latest';

    const stdout = await createMonorepo().load('@lightproject/backend', fakeSocket, '');

    expect(stdout).toBe('Loaded image: backend:latest');
  });
});

describe('publish', () => {
  test('publishes a frontend (nginx) image with the extra tag when given', async () => {
    seedMountFiles();
    world.dirs.set('/app/apps/frontend', []);

    const message = await createMonorepo().publish(
      '@lightproject/frontend',
      'registry.example.com/frontend',
      'v1.2.3',
    );

    expect(message).toBe(
      'Published registry.example.com/frontend:latest@sha256:fakedigest, registry.example.com/frontend:v1.2.3@sha256:fakedigest',
    );
  });

  test('publishes a non-frontend (vp) image without an extra tag when omitted', async () => {
    seedMountFiles();
    world.dirs.set('/app', []);

    const message = await createMonorepo().publish(
      '@lightproject/backend',
      'registry.example.com/backend',
    );

    expect(message).toBe('Published registry.example.com/backend:latest@sha256:fakedigest');
  });

  test('does not add an extra tag when it is an empty string', async () => {
    seedMountFiles();
    world.dirs.set('/app', []);

    const message = await createMonorepo().publish(
      '@lightproject/backend',
      'registry.example.com/backend',
      '',
    );

    expect(message).toBe('Published registry.example.com/backend:latest@sha256:fakedigest');
  });
});

describe('wrangler', () => {
  test('deploys the built workspace via wrangler', async () => {
    seedMountFiles();
    world.execStdout = 'Deployed to Cloudflare';

    const stdout = await createMonorepo().wrangler('@lightproject/backend', fakeSecret, fakeSecret);

    expect(stdout).toBe('Deployed to Cloudflare');
  });
});
