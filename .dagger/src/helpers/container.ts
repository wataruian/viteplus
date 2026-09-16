import { CacheSharingMode, type Container, type Directory, dag } from '@dagger.io/dagger';

import {
  PNPM_STORE_PATH,
  TASK_CACHE_PATH,
  VITE_PLUS_JS_RUNTIME_PATH,
  VITE_PLUS_PACKAGE_MANAGER_PATH,
  VITE_PLUS_USER,
  WORKSPACES,
} from './constants';

const workspace = (workspaceName: string): { isFrontend: boolean; path: string } => {
  const entry = WORKSPACES[workspaceName];
  if (!entry) {
    throw new Error(`Workspace ${workspaceName} is not supported`);
  }

  return entry;
};

const workspacePath = (workspaceName: string): string => workspace(workspaceName).path;

const isFrontend = (workspaceName: string): boolean => workspace(workspaceName).isFrontend;

const outputDirectory = (taskName: string, content: string): Directory =>
  dag.directory().withNewFile(`${taskName}.output`, content);

const installArgs = (mode: 'dev' | 'prod' = 'dev'): string[] => {
  switch (mode) {
    case 'dev': {
      return ['vp', 'install', '--frozen-lockfile'];
    }
    case 'prod': {
      return ['vp', 'install', '--prod', '--frozen-lockfile'];
    }
    default: {
      const exhaustive: never = mode;
      throw new Error(`mode must be 'dev' or 'prod', got '${exhaustive as string}'`);
    }
  }
};

const withInstallCaches = (container: Container): Container =>
  container
    .withMountedCache(
      VITE_PLUS_PACKAGE_MANAGER_PATH,
      dag.cacheVolume('vite-plus-package-manager'),
      {
        owner: VITE_PLUS_USER,
        sharing: CacheSharingMode.Locked,
      },
    )
    .withMountedCache(VITE_PLUS_JS_RUNTIME_PATH, dag.cacheVolume('vite-plus-js-runtime'), {
      owner: VITE_PLUS_USER,
      sharing: CacheSharingMode.Locked,
    })
    .withMountedCache(PNPM_STORE_PATH, dag.cacheVolume('vite-plus-pnpm-store'), {
      owner: VITE_PLUS_USER,
      sharing: CacheSharingMode.Locked,
    });

const withTaskCache = (container: Container, key: string): Container =>
  container.withMountedCache(TASK_CACHE_PATH, dag.cacheVolume(`vite-plus-task-cache-${key}`), {
    owner: VITE_PLUS_USER,
    sharing: CacheSharingMode.Locked,
  });

const withBuildEnv = (
  container: Container,
  workspaceName: string,
  buildEnv?: string[],
): Container => {
  if (buildEnv && buildEnv.length > 0 && !isFrontend(workspaceName)) {
    throw new Error(`buildEnv is only supported for frontend workspaces, got '${workspaceName}'`);
  }

  let result = container;

  for (const entry of buildEnv ?? []) {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex === -1) {
      throw new Error(`Invalid build env entry (expected KEY=VALUE): ${entry}`);
    }

    const key = entry.slice(0, separatorIndex);
    const value = entry.slice(separatorIndex + 1);
    result = result.withEnvVariable(key, value);
  }

  return result;
};

export {
  installArgs,
  isFrontend,
  outputDirectory,
  withBuildEnv,
  withInstallCaches,
  withTaskCache,
  workspace,
  workspacePath,
};
