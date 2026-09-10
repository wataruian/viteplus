import {
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
  '.gitignore',
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

  private withSource(): Container {
    return dag
      .container()
      .from(VITE_PLUS_IMAGE)
      .withWorkdir('/app')
      .withMountedDirectory('/app', this.source, { owner: VITE_PLUS_USER });
  }

  private withRootSource(): Container {
    return dag
      .container()
      .from(VITE_PLUS_IMAGE)
      .withWorkdir('/app')
      .withMountedDirectory('/app', this.rootSource, { owner: VITE_PLUS_USER });
  }

  private withInstalledRootSource(): Container {
    return this.withRootSource().withExec(['vp', 'install']);
  }

  private prune(workspace: string): Container {
    return this.withSource()
      .withExec(['vp', 'install'])
      .withExec(['vp', 'run', 'prune', workspace, '--docker']);
  }

  private install(workspace: string, mode = 'dev'): Container {
    if (mode !== 'dev' && mode !== 'prod') {
      throw new Error(`mode must be 'dev' or 'prod', got '${mode}'`);
    }

    const rootFiles = this.source.filter({ include: ROOT_FILES });
    const pruned = this.prune(workspace);
    const prunedJson = pruned.directory('.pruned/json');
    const combined = rootFiles.withDirectory('/', prunedJson);
    const installArgs = mode === 'prod' ? ['vp', 'install', '--prod'] : ['vp', 'install'];

    return dag
      .container()
      .from(VITE_PLUS_IMAGE)
      .withWorkdir('/app')
      .withDirectory('/app', combined, { owner: VITE_PLUS_USER })
      .withExec(installArgs);
  }

  private async mountFiles(workspace: string, mode = 'dev'): Promise<Container> {
    const installContainer = this.install(workspace, mode);

    const pruned = this.prune(workspace);
    const prunedFull = pruned.directory('.pruned/full');
    const fullEntries = await prunedFull.entries();

    let container = installContainer;
    for (const dir of ['apps', 'packages']) {
      if (fullEntries.includes(`${dir}/`)) {
        container = container.withDirectory(`/app/${dir}`, prunedFull.directory(dir), {
          owner: VITE_PLUS_USER,
        });
      }
    }

    return container;
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
  public async build(workspace: string): Promise<Container> {
    const container = await this.mountFiles(workspace, 'dev');

    return container.withExec(['vp', 'run', '-r', 'build']);
  }

  @func()
  public async buildArtifact(workspace: string): Promise<Directory> {
    const buildContainer = await this.build(workspace);

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
  public async test(workspace: string): Promise<Directory> {
    const container = await this.build(workspace);

    const testContainer = container.withExec(['vp', 'run', '--filter', workspace, 'test']);

    const workspacePath = Monorepo.workspacePath(workspace);
    const coverageDir = testContainer.directory(`/app/${workspacePath}/coverage`);

    const stdout = await testContainer.stdout();

    return Monorepo.outputDirectory('test', stdout).withDirectory('coverage', coverageDir);
  }

  @func()
  public async nginx(workspace: string): Promise<Container> {
    const buildContainer = await this.build(workspace);

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

    return container.withDefaultArgs(['nginx', '-g', 'daemon off;']);
  }

  @func()
  public async vp(workspace: string): Promise<Container> {
    const buildContainer = await this.build(workspace);

    let container = this.install(workspace, 'prod');

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

    return container
      .withWorkdir(`/app/${workspacePath}`)
      .withDefaultArgs(['node', 'dist/index.mjs']);
  }

  @func()
  public async load(workspace: string, dockerSocket: Socket, tag?: string): Promise<string> {
    const isFrontend = Monorepo.isFrontend(workspace);
    const container = isFrontend ? await this.nginx(workspace) : await this.vp(workspace);

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
  public async publish(workspace: string, address: string, tag?: string): Promise<string> {
    const isFrontend = Monorepo.isFrontend(workspace);
    const container = isFrontend ? await this.nginx(workspace) : await this.vp(workspace);

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
  ): Promise<string> {
    const container = await this.build(workspace);

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

    return deployContainer.withExec(['vp', 'exec', 'wrangler', 'deploy']).stdout();
  }
}
