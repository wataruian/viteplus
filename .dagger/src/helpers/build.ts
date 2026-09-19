import { type Container, type Directory, dag } from '@dagger.io/dagger';

import {
  DAGGER_WORKSPACE,
  MANIFEST_FILES,
  ROOT_FILES,
  VITE_PLUS_IMAGE,
  VITE_PLUS_USER,
  WORKSPACE_NAMES,
} from './constants';
import { installArgs, withInstallCaches, withTaskCache, workspacePath } from './container';
import { readStringRecord } from './json';

const withRootSource = (rootSource: Directory): Container =>
  withInstallCaches(
    dag
      .container()
      .from(VITE_PLUS_IMAGE)
      .withWorkdir('/app')
      .withDirectory('/app', rootSource, { owner: VITE_PLUS_USER }),
  );

const withInstalledRootSource = (rootSource: Directory): Container =>
  withTaskCache(withRootSource(rootSource).withExec(installArgs()), 'root');

const internalDependencyPaths = async (source: Directory, workspace: string): Promise<string[]> => {
  const manifestEntries = await Promise.all(
    WORKSPACE_NAMES.map(async (name): Promise<[string, Record<string, string>]> => {
      const raw = await source.file(`${workspacePath(name)}/package.json`).contents();
      const parsed: unknown = JSON.parse(raw);
      const fields = typeof parsed === 'object' && parsed !== null ? parsed : {};
      const { dependencies, devDependencies } = fields as {
        dependencies?: unknown;
        devDependencies?: unknown;
      };

      return [name, { ...readStringRecord(dependencies), ...readStringRecord(devDependencies) }];
    }),
  );
  const dependenciesByName = new Map(manifestEntries);

  const visited = new Set<string>();
  const queue = [workspace];

  let current = queue.shift();
  while (current !== undefined) {
    if (!visited.has(current)) {
      visited.add(current);

      for (const [name, version] of Object.entries(dependenciesByName.get(current) ?? {})) {
        if (version === 'workspace:*' && !visited.has(name)) {
          queue.push(name);
        }
      }
    }

    current = queue.shift();
  }

  visited.delete(workspace);
  return [...visited].map((name) => workspacePath(name));
};

const prune = async (source: Directory, workspace: string): Promise<Container> => {
  const workspaceDir = workspacePath(workspace);
  const dependencyPaths = await internalDependencyPaths(source, workspace);

  let container = withInstallCaches(
    dag
      .container()
      .from(VITE_PLUS_IMAGE)
      .withWorkdir('/app')
      .withDirectory('/app', source.filter({ include: MANIFEST_FILES }), {
        owner: VITE_PLUS_USER,
      }),
  );

  for (const path of [workspaceDir, ...dependencyPaths]) {
    container = container.withDirectory(`/app/${path}`, source.directory(path), {
      owner: VITE_PLUS_USER,
    });
  }

  return container.withExec([
    'vpx',
    'npm:turbo@2.10.12',
    'prune',
    '--out-dir',
    './.pruned',
    '--docker',
    workspace,
  ]);
};

const install = (source: Directory, pruned: Container, mode: 'dev' | 'prod' = 'dev'): Container => {
  const rootFiles = source.filter({ include: ROOT_FILES });
  const prunedJson = pruned.directory('.pruned/json');
  const combined = rootFiles.withDirectory('/', prunedJson);

  return withInstallCaches(
    dag
      .container()
      .from(VITE_PLUS_IMAGE)
      .withWorkdir('/app')
      .withDirectory('/app', combined, { owner: VITE_PLUS_USER }),
  ).withExec(installArgs(mode));
};

const mountFiles = async (
  source: Directory,
  workspace: string,
  mode: 'dev' | 'prod' = 'dev',
): Promise<Container> => {
  const pruned = await prune(source, workspace);
  const installContainer = install(source, pruned, mode);

  const prunedFull = pruned.directory('.pruned/full').filter({ exclude: ['**/node_modules'] });
  const fullEntries = await prunedFull.entries();

  let container = installContainer;
  for (const dir of ['apps', 'packages']) {
    if (fullEntries.includes(`${dir}/`)) {
      container = container.withDirectory(`/app/${dir}`, prunedFull.directory(dir), {
        owner: VITE_PLUS_USER,
      });
    }
  }

  return withTaskCache(container, workspacePath(workspace).replaceAll('/', '-'));
};

const mountDaggerFiles = (rootSource: Directory): Container => {
  const combined = rootSource
    .filter({ include: MANIFEST_FILES })
    .withDirectory('.dagger', rootSource.directory('.dagger'));

  const container = withInstallCaches(
    dag
      .container()
      .from(VITE_PLUS_IMAGE)
      .withWorkdir('/app')
      .withDirectory('/app', combined, { owner: VITE_PLUS_USER }),
  ).withExec(installArgs());

  return withTaskCache(container, DAGGER_WORKSPACE).withWorkdir('/app');
};

export {
  install,
  internalDependencyPaths,
  mountDaggerFiles,
  mountFiles,
  prune,
  withInstalledRootSource,
  withRootSource,
};
