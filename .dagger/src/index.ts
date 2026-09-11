import {
  CacheSharingMode,
  type Container,
  type Directory,
  type File,
  type Secret,
  type Socket,
  argument,
  dag,
  func,
  object,
} from '@dagger.io/dagger';

const VITE_PLUS_IMAGE = 'ghcr.io/voidzero-dev/vite-plus:0.3.0';
const VITE_PLUS_USER = 'vp';
const VITE_PLUS_PACKAGE_MANAGER_PATH = '/home/vp/.vite-plus/package_manager';
const VITE_PLUS_JS_RUNTIME_PATH = '/home/vp/.vite-plus/js_runtime';
const PNPM_STORE_PATH = '/home/vp/.local/share/pnpm/store';
const TASK_CACHE_PATH = '/app/node_modules/.vite/task-cache';

const NGINX_IMAGE = 'nginx:1.27.0-alpine';
const DOCKER_CLI_VERSION = 'docker:27-cli';

const SOURCE_IGNORE = [
  '**/.DS_Store',
  '**/.idea',
  '.ai-data',
  '.aiassistant',
  '.cursor',
  '.dagger',
  '.git',
  '.github',
  '.mise',
  '.outputs',
  '**/.pruned',
  '.templates',
  '**/.vite-hooks',
  '.vscode',
  '**/bak',
  'configs',
  '**/tmp',
  '.editorconfig',
  '**/.env',
  '.env.example',
  '.gitattributes',
  '.miserc.toml',
  'AGENTS.md',
  'CLAUDE.md',
  'commitlint.config.ts',
  'CONTRIBUTING.md',
  'dagger.json',
  'docker-compose.yml',
  'GEMINI.md',
  'install.sh',
  'LICENSE',
  'mise.lock',
  'mise.toml',
  'plopfile.ts',
  'README.md',
  'SECURITY.md',
  'tsconfig.reference.json',
  'vite.config.d.ts',
  'vite.config.d.ts.map',
  '**/node_modules',
  '**/dist',
  '**/out',
  '**/coverage',
  '**/storybook-static',
  '**/.wrangler',
  '**/*.tsbuildinfo',
];

const ROOT_FILES = [
  'root.txt',
  'tsconfig.base.json',
  'tsconfig.json',
  'tsconfig.madge.json',
  'vite.config.ts',
];

const MANIFEST_FILES = [
  'package.json',
  '**/package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  '.gitignore',
  ...ROOT_FILES,
];

const WORKSPACE_NAMES = [
  '@lightproject/library',
  '@lightproject/common',
  '@lightproject/design-system',
  '@lightproject/backend',
  '@lightproject/frontend',
];

const readStringRecord = (value: unknown): Record<string, string> => {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      result[key] = entry;
    }
  }

  return result;
};

const BUILD_ARTIFACT_KEEP = [
  'dist',
  'out',
  'storybook-static',
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
];

@object()
export class Monorepo {
  public source: Directory;
  public rootSource: Directory;

  public constructor(
    @argument({ defaultPath: '/', ignore: SOURCE_IGNORE }) source: Directory,
    @argument({ defaultPath: '.dagger' }) daggerSource: Directory,
    @argument({ defaultPath: '.templates' }) templatesSource: Directory,
    @argument({ defaultPath: 'commitlint.config.ts' }) commitlintConfig: File,
    @argument({ defaultPath: 'plopfile.ts' }) plopfile: File,
  ) {
    this.source = source;
    this.rootSource = source
      .withDirectory('.dagger', daggerSource)
      .withDirectory('.templates', templatesSource)
      .withFile('commitlint.config.ts', commitlintConfig)
      .withFile('plopfile.ts', plopfile);
  }

  private static workspacePath(workspace: string): string {
    switch (workspace) {
      case '@lightproject/library': {
        return 'packages/library';
      }
      case '@lightproject/common': {
        return 'packages/common';
      }
      case '@lightproject/design-system': {
        return 'packages/design-system';
      }
      case '@lightproject/backend': {
        return 'apps/backend';
      }
      case '@lightproject/frontend': {
        return 'apps/frontend';
      }
      default: {
        throw new Error(`Workspace ${workspace} is not supported`);
      }
    }
  }

  private static isFrontend(workspace: string): boolean {
    const workspacePath = Monorepo.workspacePath(workspace);

    if (!workspacePath) {
      throw new Error(`Workspace ${workspace} is not supported`);
    }

    switch (workspace) {
      case '@lightproject/design-system':
      case '@lightproject/frontend': {
        return true;
      }
      default: {
        return false;
      }
    }
  }

  private static outputDirectory(taskName: string, content: string): Directory {
    return dag.directory().withNewFile(`${taskName}.output`, content);
  }

  private static withInstallCaches(container: Container): Container {
    return container
      .withMountedCache(
        VITE_PLUS_PACKAGE_MANAGER_PATH,
        dag.cacheVolume('vite-plus-package-manager'),
        { owner: VITE_PLUS_USER, sharing: CacheSharingMode.Locked },
      )
      .withMountedCache(VITE_PLUS_JS_RUNTIME_PATH, dag.cacheVolume('vite-plus-js-runtime'), {
        owner: VITE_PLUS_USER,
        sharing: CacheSharingMode.Locked,
      })
      .withMountedCache(PNPM_STORE_PATH, dag.cacheVolume('vite-plus-pnpm-store'), {
        owner: VITE_PLUS_USER,
        sharing: CacheSharingMode.Locked,
      });
  }

  private static withTaskCache(container: Container, key: string): Container {
    return container.withMountedCache(
      TASK_CACHE_PATH,
      dag.cacheVolume(`vite-plus-task-cache-${key}`),
      { owner: VITE_PLUS_USER, sharing: CacheSharingMode.Locked },
    );
  }

  private static withBuildEnv(
    container: Container,
    workspace: string,
    buildEnv?: string[],
  ): Container {
    if (buildEnv && buildEnv.length > 0 && !Monorepo.isFrontend(workspace)) {
      throw new Error(`buildEnv is only supported for frontend workspaces, got '${workspace}'`);
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
  }

  private withRootSource(): Container {
    return Monorepo.withInstallCaches(
      dag
        .container()
        .from(VITE_PLUS_IMAGE)
        .withWorkdir('/app')
        .withDirectory('/app', this.rootSource, { owner: VITE_PLUS_USER }),
    );
  }

  private withInstalledRootSource(): Container {
    return Monorepo.withTaskCache(this.withRootSource().withExec(['vp', 'install']), 'root');
  }

  private async internalDependencyPaths(workspace: string): Promise<string[]> {
    const manifestEntries = await Promise.all(
      WORKSPACE_NAMES.map(async (name): Promise<[string, Record<string, string>]> => {
        const raw = await this.source
          .file(`${Monorepo.workspacePath(name)}/package.json`)
          .contents();
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
    return [...visited].map((name) => Monorepo.workspacePath(name));
  }

  private async prune(workspace: string): Promise<Container> {
    const workspacePath = Monorepo.workspacePath(workspace);
    const dependencyPaths = await this.internalDependencyPaths(workspace);

    let container = Monorepo.withInstallCaches(
      dag
        .container()
        .from(VITE_PLUS_IMAGE)
        .withWorkdir('/app')
        .withDirectory('/app', this.source.filter({ include: MANIFEST_FILES }), {
          owner: VITE_PLUS_USER,
        }),
    );

    for (const path of [workspacePath, ...dependencyPaths]) {
      container = container.withDirectory(`/app/${path}`, this.source.directory(path), {
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
  }

  private async install(workspace: string, mode = 'dev'): Promise<Container> {
    if (mode !== 'dev' && mode !== 'prod') {
      throw new Error(`mode must be 'dev' or 'prod', got '${mode}'`);
    }

    const rootFiles = this.source.filter({ include: ROOT_FILES });
    const pruned = await this.prune(workspace);
    const prunedJson = pruned.directory('.pruned/json');
    const combined = rootFiles.withDirectory('/', prunedJson);
    const installArgs = mode === 'prod' ? ['vp', 'install', '--prod'] : ['vp', 'install'];

    return Monorepo.withInstallCaches(
      dag
        .container()
        .from(VITE_PLUS_IMAGE)
        .withWorkdir('/app')
        .withDirectory('/app', combined, { owner: VITE_PLUS_USER }),
    ).withExec(installArgs);
  }

  private async mountFiles(workspace: string, mode = 'dev'): Promise<Container> {
    const installContainer = await this.install(workspace, mode);

    const pruned = await this.prune(workspace);
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

    return Monorepo.withTaskCache(
      container,
      Monorepo.workspacePath(workspace).replaceAll('/', '-'),
    );
  }

  @func()
  public async ready(): Promise<Directory> {
    const container = this.withInstalledRootSource();

    const stdout = await container.withExec(['vp', 'run', 'ready']).stdout();

    return Monorepo.outputDirectory('ready', stdout);
  }

  @func()
  public async madge(): Promise<Directory> {
    const container = this.withInstalledRootSource();

    const stdout = await container.withExec(['vp', 'run', '-r', 'madge']).stdout();

    return Monorepo.outputDirectory('madge', stdout);
  }

  @func()
  public async root(): Promise<Directory> {
    const container = this.withInstalledRootSource();

    const stdout = await container.withExec(['vp', 'run', '-r', 'root']).stdout();

    return Monorepo.outputDirectory('root', stdout);
  }

  @func()
  public async check(workspace: string): Promise<Directory> {
    const container = await this.mountFiles(workspace, 'dev');

    const stdout = await container.withExec(['vp', 'run', '-r', 'check']).stdout();

    return Monorepo.outputDirectory('check', stdout);
  }

  @func()
  public async format(workspace: string): Promise<Directory> {
    const container = await this.mountFiles(workspace, 'dev');

    const stdout = await container.withExec(['vp', 'run', '-r', 'format']).stdout();

    return Monorepo.outputDirectory('format', stdout);
  }

  @func()
  public async lint(workspace: string): Promise<Directory> {
    const container = await this.mountFiles(workspace, 'dev');

    const stdout = await container.withExec(['vp', 'run', '-r', 'lint']).stdout();

    return Monorepo.outputDirectory('lint', stdout);
  }

  @func()
  public async typeCheck(workspace: string): Promise<Directory> {
    const container = await this.mountFiles(workspace, 'dev');

    const stdout = await container.withExec(['vp', 'run', '-r', 'type-check']).stdout();

    return Monorepo.outputDirectory('type-check', stdout);
  }

  @func()
  public async build(workspace: string, buildEnv?: string[]): Promise<Container> {
    const container = await this.mountFiles(workspace, 'dev');

    return Monorepo.withBuildEnv(container, workspace, buildEnv).withExec([
      'vp',
      'run',
      '-r',
      'build',
    ]);
  }

  @func()
  public async buildArtifact(workspace: string, buildEnv?: string[]): Promise<Directory> {
    const buildContainer = await this.build(workspace, buildEnv);

    const pruneArgs = BUILD_ARTIFACT_KEEP.map((name) => `! -name '${name}'`).join(' ');
    const script = [
      'set -eu',
      'rm -rf /app/node_modules',
      'for group in apps packages; do',
      '  [ -d "/app/$group" ] || continue',
      '  for pkg in "/app/$group"/*/; do',
      '    [ -d "$pkg" ] || continue',
      `    find "$pkg" -mindepth 1 -maxdepth 1 ${pruneArgs} -exec rm -rf {} +`,
      '  done',
      'done',
    ].join('\n');

    return buildContainer.withExec(['sh', '-c', script]).directory('/app');
  }

  @func()
  public async test(workspace: string, buildEnv?: string[]): Promise<Directory> {
    const container = await this.build(workspace, buildEnv);

    const testContainer = container.withExec(['vp', 'run', '--filter', workspace, 'test']);

    const workspacePath = Monorepo.workspacePath(workspace);
    const coverageDir = testContainer.directory(`/app/${workspacePath}/coverage`);

    const stdout = await testContainer.stdout();

    return Monorepo.outputDirectory('test', stdout).withDirectory('coverage', coverageDir);
  }

  @func()
  public async nginx(workspace: string, buildEnv?: string[]): Promise<Container> {
    const buildContainer = await this.build(workspace, buildEnv);

    const workspacePath = Monorepo.workspacePath(workspace);
    const workspaceDir = buildContainer.directory(`/app/${workspacePath}`);
    const entries = await workspaceDir.entries();

    let container = dag
      .container()
      .from(NGINX_IMAGE)
      .withExec(['rm', '/etc/nginx/conf.d/default.conf'])
      .withFile('/etc/nginx/conf.d/nginx.conf', this.source.file(`${workspacePath}/nginx.conf`))
      .withExposedPort(80);

    for (const artifactDir of ['out', 'dist']) {
      if (entries.includes(`${artifactDir}/`)) {
        container = container.withDirectory(
          '/usr/share/nginx/html/vite',
          workspaceDir.directory(artifactDir),
        );
        break;
      }
    }

    if (entries.includes('storybook-static/')) {
      container = container
        .withDirectory(
          '/usr/share/nginx/html/storybook',
          workspaceDir.directory('storybook-static'),
        )
        .withExposedPort(81);
    }

    return Monorepo.withBuildEnv(container, workspace, buildEnv).withDefaultArgs([
      'nginx',
      '-g',
      'daemon off;',
    ]);
  }

  @func()
  public async vp(workspace: string, buildEnv?: string[]): Promise<Container> {
    const buildContainer = await this.build(workspace, buildEnv);

    let container = await this.install(workspace, 'prod');

    const rootEntries = await buildContainer.directory('/app').entries();
    const groups = ['apps', 'packages'].filter((group) => rootEntries.includes(`${group}/`));

    const groupEntries = await Promise.all(
      groups.map(async (group) => await buildContainer.directory(`/app/${group}`).entries()),
    );

    const pkgPaths = groups.flatMap((group, index) =>
      groupEntries[index]
        .filter((entry) => entry.endsWith('/'))
        .map((entry) => `${group}/${entry.slice(0, -1)}`),
    );

    const pkgEntriesList = await Promise.all(
      pkgPaths.map(async (pkgPath) => await buildContainer.directory(`/app/${pkgPath}`).entries()),
    );

    for (const [index, pkgPath] of pkgPaths.entries()) {
      for (const artifactDir of ['dist']) {
        if (pkgEntriesList[index].includes(`${artifactDir}/`)) {
          container = container.withDirectory(
            `/app/${pkgPath}/${artifactDir}`,
            buildContainer.directory(`/app/${pkgPath}/${artifactDir}`),
            { owner: VITE_PLUS_USER },
          );
        }
      }
    }

    const workspacePath = Monorepo.workspacePath(workspace);

    return Monorepo.withBuildEnv(container, workspace, buildEnv)
      .withWorkdir(`/app/${workspacePath}`)
      .withDefaultArgs(['node', 'dist/index.mjs']);
  }

  @func()
  public async load(
    workspace: string,
    dockerSocket: Socket,
    tag?: string,
    buildEnv?: string[],
  ): Promise<string> {
    const isFrontend = Monorepo.isFrontend(workspace);
    const container = isFrontend
      ? await this.nginx(workspace, buildEnv)
      : await this.vp(workspace, buildEnv);

    const workspacePath = Monorepo.workspacePath(workspace);
    const imageName = workspacePath.split('/').pop();

    const refs = [`${imageName}:latest`];
    if (tag !== undefined && tag !== '') {
      refs.push(`${imageName}:${tag}`);
    }

    const script = [
      'set -eu',
      'output=$(docker load -i /tmp/image.tar)',
      'echo "$output"',
      'id=$(echo "$output" | awk \'{print $NF}\')',
      ...refs.map((ref) => `docker tag "$id" "${ref}"`),
      `echo "Tagged $id as ${refs.join(', ')}"`,
    ].join('\n');

    return dag
      .container()
      .from(DOCKER_CLI_VERSION)
      .withUnixSocket('/var/run/docker.sock', dockerSocket)
      .withMountedFile('/tmp/image.tar', container.asTarball())
      .withExec(['sh', '-c', script])
      .stdout();
  }

  @func()
  public async publish(
    workspace: string,
    address: string,
    tag?: string,
    buildEnv?: string[],
  ): Promise<string> {
    const isFrontend = Monorepo.isFrontend(workspace);
    const container = isFrontend
      ? await this.nginx(workspace, buildEnv)
      : await this.vp(workspace, buildEnv);

    const refs = [`${address}:latest`];
    if (tag !== undefined && tag !== '') {
      refs.push(`${address}:${tag}`);
    }

    const publishedRefs = await Promise.all(refs.map(async (ref) => await container.publish(ref)));

    return `Published ${publishedRefs.join(', ')}`;
  }

  @func()
  public async wrangler(
    workspace: string,
    cloudflareApiToken: Secret,
    cloudflareAccountId?: string,
    buildEnv?: string[],
  ): Promise<string> {
    const container = await this.build(workspace, buildEnv);

    const workspacePath = Monorepo.workspacePath(workspace);

    let deployContainer = container
      .withWorkdir(`/app/${workspacePath}`)
      .withSecretVariable('CLOUDFLARE_API_TOKEN', cloudflareApiToken);

    if (cloudflareAccountId !== undefined && cloudflareAccountId !== '') {
      deployContainer = deployContainer.withEnvVariable(
        'CLOUDFLARE_ACCOUNT_ID',
        cloudflareAccountId,
      );
    }

    return Monorepo.withBuildEnv(deployContainer, workspace, buildEnv)
      .withExec(['vp', 'exec', 'wrangler', 'deploy'])
      .stdout();
  }
}
