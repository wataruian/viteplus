import { beforeEach, describe, expect, test } from 'vite-plus/test';

import {
  install,
  internalDependencyPaths,
  mountDaggerFiles,
  mountFiles,
  prune,
  withInstalledRootSource,
  withRootSource,
} from '../src/helpers/build';
import { PNPM_STORE_PATH, TASK_CACHE_PATH, VITE_PLUS_IMAGE } from '../src/helpers/constants';
import { installArgs } from '../src/helpers/container';
import { FakeContainer, FakeDirectory, asFakeContainer } from './helpers/dagger-fakes';
import { resetDaggerWorld, world } from './helpers/dagger-world';
import { seedPackageJsons } from './helpers/fixtures';

beforeEach(() => {
  resetDaggerWorld();
});

describe('withRootSource', () => {
  test('starts from the vite-plus image with install caches mounted at /app', () => {
    const container = withRootSource(new FakeDirectory(world));
    const fake = asFakeContainer(container);

    expect(fake.capturedImage).toBe(VITE_PLUS_IMAGE);
    expect(fake.capturedWorkdir).toBe('/app');
    expect(fake.capturedDirectoryPaths).toStrictEqual(['/app']);
    expect(fake.capturedCachePaths.length).toBeGreaterThan(0);
  });
});

describe('withInstalledRootSource', () => {
  test('installs dependencies and mounts the root task cache', () => {
    const container = withInstalledRootSource(new FakeDirectory(world));
    const fake = asFakeContainer(container);

    expect(fake.capturedExecCalls).toStrictEqual([installArgs()]);
    expect(fake.capturedCachePaths).toContain(TASK_CACHE_PATH);
  });
});

describe('internalDependencyPaths', () => {
  test('returns nothing when the workspace has no internal dependencies', async () => {
    seedPackageJsons();

    const paths = await internalDependencyPaths(new FakeDirectory(world), '@lightproject/backend');

    expect(paths).toStrictEqual([]);
  });

  test('ignores non-workspace dependency versions', async () => {
    seedPackageJsons({
      '@lightproject/backend': { dependencies: { react: '^18.0.0' } },
    });

    const paths = await internalDependencyPaths(new FakeDirectory(world), '@lightproject/backend');

    expect(paths).toStrictEqual([]);
  });

  test('walks transitive workspace:* dependencies, skipping cycles back to already-visited workspaces', async () => {
    seedPackageJsons({
      '@lightproject/design-system': {
        dependencies: {
          '@lightproject/common': 'workspace:*',
          '@lightproject/frontend': 'workspace:*',
          react: '^18.0.0',
        },
      },
      '@lightproject/frontend': {
        dependencies: { '@lightproject/design-system': 'workspace:*' },
      },
    });

    const paths = await internalDependencyPaths(new FakeDirectory(world), '@lightproject/frontend');

    expect(paths.toSorted()).toStrictEqual(['packages/common', 'packages/design-system']);
  });

  test('reads devDependencies as well as dependencies', async () => {
    seedPackageJsons({
      '@lightproject/backend': {
        devDependencies: { '@lightproject/common': 'workspace:*' },
      },
    });

    const paths = await internalDependencyPaths(new FakeDirectory(world), '@lightproject/backend');

    expect(paths).toStrictEqual(['packages/common']);
  });

  test('visits a diamond dependency only once even when queued from two parents', async () => {
    seedPackageJsons({
      '@lightproject/backend': {
        dependencies: {
          '@lightproject/design-system': 'workspace:*',
          '@lightproject/frontend': 'workspace:*',
        },
      },
      '@lightproject/design-system': {
        dependencies: { '@lightproject/common': 'workspace:*' },
      },
      '@lightproject/frontend': {
        dependencies: { '@lightproject/common': 'workspace:*' },
      },
    });

    const paths = await internalDependencyPaths(new FakeDirectory(world), '@lightproject/backend');

    expect(paths.toSorted()).toStrictEqual([
      'apps/frontend',
      'packages/common',
      'packages/design-system',
    ]);
  });

  test('treats a non-object package.json as having no dependencies', async () => {
    seedPackageJsons();
    world.files.set('apps/backend/package.json', 'null');

    const paths = await internalDependencyPaths(new FakeDirectory(world), '@lightproject/backend');

    expect(paths).toStrictEqual([]);
  });

  test('throws if a workspace:* dependency points outside the known workspaces', async () => {
    seedPackageJsons({
      '@lightproject/backend': {
        dependencies: { '@lightproject/does-not-exist': 'workspace:*' },
      },
    });

    await expect(
      internalDependencyPaths(new FakeDirectory(world), '@lightproject/backend'),
    ).rejects.toThrow('Workspace @lightproject/does-not-exist is not supported');
  });
});

describe('prune', () => {
  test('mounts the workspace and its dependencies, then prunes with turbo', async () => {
    seedPackageJsons({
      '@lightproject/frontend': {
        dependencies: { '@lightproject/design-system': 'workspace:*' },
      },
    });

    const container = await prune(new FakeDirectory(world), '@lightproject/frontend');
    const fake = asFakeContainer(container);

    expect(fake.capturedImage).toBe(VITE_PLUS_IMAGE);
    expect(fake.capturedDirectoryPaths).toStrictEqual([
      '/app',
      '/app/apps/frontend',
      '/app/packages/design-system',
    ]);
    expect(fake.capturedExecCalls).toStrictEqual([
      [
        'vpx',
        'npm:turbo@2.10.12',
        'prune',
        '--out-dir',
        './.pruned',
        '--docker',
        '@lightproject/frontend',
      ],
    ]);
  });
});

describe('install', () => {
  test('installs from the pruned workspace with the dev install args by default', () => {
    seedPackageJsons();
    const pruned = new FakeContainer(world);

    const container = install(new FakeDirectory(world), pruned);
    const fake = asFakeContainer(container);

    expect(fake.capturedImage).toBe(VITE_PLUS_IMAGE);
    expect(fake.capturedWorkdir).toBe('/app');
    expect(fake.capturedExecCalls).toStrictEqual([installArgs('dev')]);
    expect(fake.capturedCachePaths).toContain(PNPM_STORE_PATH);
  });

  test('uses the prod install args when requested', () => {
    seedPackageJsons();
    const pruned = new FakeContainer(world);

    const container = install(new FakeDirectory(world), pruned, 'prod');

    expect(asFakeContainer(container).capturedExecCalls).toStrictEqual([installArgs('prod')]);
  });
});

describe('mountFiles', () => {
  test('mounts both apps and packages when the pruned output has both', async () => {
    seedPackageJsons();
    world.dirs.set('.pruned/full', ['apps/', 'packages/']);

    const container = await mountFiles(new FakeDirectory(world), '@lightproject/backend');
    const fake = asFakeContainer(container);

    expect(fake.capturedDirectoryPaths).toContain('/app/apps');
    expect(fake.capturedDirectoryPaths).toContain('/app/packages');
    expect(fake.capturedCachePaths).toContain(TASK_CACHE_PATH);
  });

  test('mounts neither directory when the pruned output has neither', async () => {
    seedPackageJsons();
    world.dirs.set('.pruned/full', []);

    const container = await mountFiles(new FakeDirectory(world), '@lightproject/backend');
    const fake = asFakeContainer(container);

    expect(fake.capturedDirectoryPaths).not.toContain('/app/apps');
    expect(fake.capturedDirectoryPaths).not.toContain('/app/packages');
  });
});

describe('mountDaggerFiles', () => {
  test('mounts only the root manifest files plus .dagger, installs, and sets the workdir', () => {
    const container = mountDaggerFiles(new FakeDirectory(world));
    const fake = asFakeContainer(container);

    expect(fake.capturedImage).toBe(VITE_PLUS_IMAGE);
    expect(fake.capturedDirectoryPaths).toStrictEqual(['/app']);
    expect(fake.capturedExecCalls).toStrictEqual([installArgs()]);
    expect(fake.capturedCachePaths).toContain(TASK_CACHE_PATH);
    expect(fake.capturedWorkdir).toBe('/app');
  });
});
