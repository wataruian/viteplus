import { CacheSharingMode, type Container, type Directory, dag } from '@dagger.io/dagger';

import {
  DEPLOY_ENVIRONMENTS,
  PLAYWRIGHT_BROWSERS_PATH,
  PNPM_STORE_PATH,
  POSTGRES_IMAGE,
  POSTGRES_SERVICE_CREDENTIAL,
  POSTGRES_SERVICE_HOST,
  POSTGRES_SERVICE_PORT,
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

const shortWorkspaceName = (workspaceDir: string): string => {
  const [, name] = workspaceDir.split('/');
  return name;
};

const outputDirectory = (taskName: string, content: string): Directory =>
  dag.directory().withNewFile(`${taskName}.output`, content);

const installArgs = (mode: 'dev' | 'prod' = 'dev'): string[] =>
  mode === 'prod'
    ? ['vp', 'install', '--prod', '--frozen-lockfile']
    : ['vp', 'install', '--frozen-lockfile'];

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

const WORKER_VAR_KEY = /^[A-Z][A-Z0-9_]*$/u;

const workerVarArgs = (workspaceName: string, workerVars?: string[]): string[] => {
  if (!workerVars || workerVars.length === 0) {
    return [];
  }

  if (isFrontend(workspaceName)) {
    throw new Error(`workerVar is only supported for backend workspaces, got '${workspaceName}'`);
  }

  return workerVars.flatMap((entry) => {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex === -1) {
      throw new Error(`Invalid worker var entry (expected KEY=VALUE): ${entry}`);
    }

    const key = entry.slice(0, separatorIndex);
    const value = entry.slice(separatorIndex + 1);
    if (!WORKER_VAR_KEY.test(key)) {
      throw new Error(`Invalid worker var name '${key}' (expected UPPER_SNAKE_CASE)`);
    }
    if (value === '' || /\s/u.test(value)) {
      throw new Error(`Invalid worker var value for '${key}' (must be non-empty, no whitespace)`);
    }

    return ['--var', `${key}:${value}`];
  });
};

const assertDeployEnvironment = (environment: string): void => {
  if (!DEPLOY_ENVIRONMENTS.has(environment)) {
    throw new Error(
      `Invalid environment '${environment}' (expected one of: ${[...DEPLOY_ENVIRONMENTS].join(', ')})`,
    );
  }
};

const withoutProxy = (container: Container): Container =>
  container
    .withEnvVariable('HTTP_PROXY', '')
    .withEnvVariable('HTTPS_PROXY', '')
    .withEnvVariable('http_proxy', '')
    .withEnvVariable('https_proxy', '');

const withPostgres = (container: Container): Container => {
  const postgres = dag
    .container()
    .from(POSTGRES_IMAGE)
    .withEnvVariable('POSTGRES_USER', POSTGRES_SERVICE_CREDENTIAL)
    .withEnvVariable('POSTGRES_PASSWORD', POSTGRES_SERVICE_CREDENTIAL)
    .withEnvVariable('POSTGRES_DB', POSTGRES_SERVICE_CREDENTIAL)
    .withExposedPort(POSTGRES_SERVICE_PORT)
    .asService({ useEntrypoint: true });

  const credential = POSTGRES_SERVICE_CREDENTIAL;
  const url = `postgres://${credential}:${credential}@${POSTGRES_SERVICE_HOST}:${POSTGRES_SERVICE_PORT}/${credential}`;

  return container
    .withServiceBinding(POSTGRES_SERVICE_HOST, postgres)
    .withEnvVariable('POSTGRES_URL', url);
};

const withPlaywrightChromium = (container: Container, workspaceName: string): Container =>
  container
    .withUser('root')
    .withExec([
      'sed',
      '-i',
      's|http://deb.debian.org|https://deb.debian.org|g',
      '/etc/apt/sources.list.d/debian.sources',
    ])
    .withNewFile(
      '/etc/apt/apt.conf.d/99-no-proxy',
      'Acquire::http::Proxy "false";\nAcquire::https::Proxy "false";\n',
    )
    .withExec(['vp', 'exec', '--filter', workspaceName, 'playwright', 'install-deps', 'chromium'])
    .withUser(VITE_PLUS_USER)
    .withMountedCache(PLAYWRIGHT_BROWSERS_PATH, dag.cacheVolume('playwright-browsers'), {
      owner: VITE_PLUS_USER,
      sharing: CacheSharingMode.Locked,
    })
    .withEnvVariable('PLAYWRIGHT_BROWSERS_PATH', PLAYWRIGHT_BROWSERS_PATH)
    .withExec(['vp', 'exec', '--filter', workspaceName, 'playwright', 'install', 'chromium']);

export {
  WORKER_VAR_KEY,
  assertDeployEnvironment,
  installArgs,
  isFrontend,
  outputDirectory,
  shortWorkspaceName,
  withBuildEnv,
  withInstallCaches,
  withPlaywrightChromium,
  withPostgres,
  withTaskCache,
  withoutProxy,
  workerVarArgs,
  workspace,
  workspacePath,
};
