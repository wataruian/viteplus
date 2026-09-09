import { type Container, type Directory, argument, dag, func, object } from '@dagger.io/dagger';

const VITE_PLUS_IMAGE = 'ghcr.io/voidzero-dev/vite-plus:0.3.0';
const VITE_PLUS_USER = 'vp';

const SOURCE_IGNORE = [
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
  'bak',
  'configs',
  '**/tmp',
  '.editorconfig',
  '.env',
  'env.example',
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

@object()
export class Monorepo {
  public source: Directory;

  public constructor(@argument({ defaultPath: '/', ignore: SOURCE_IGNORE }) source: Directory) {
    this.source = source;
  }

  private withSource(): Container {
    return dag
      .container()
      .from(VITE_PLUS_IMAGE)
      .withWorkdir('/app')
      .withMountedDirectory('/app', this.source, { owner: VITE_PLUS_USER });
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
      .withMountedDirectory('/app', combined, { owner: VITE_PLUS_USER })
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
  public async check(workspace: string): Promise<Container> {
    const container = await this.mountFiles(workspace, 'dev');

    return container.withExec(['vp', 'run', '-r', 'check']);
  }

  @func()
  public async format(workspace: string): Promise<Container> {
    const container = await this.mountFiles(workspace, 'dev');

    return container.withExec(['vp', 'run', '-r', 'format']);
  }

  @func()
  public async lint(workspace: string): Promise<Container> {
    const container = await this.mountFiles(workspace, 'dev');

    return container.withExec(['vp', 'run', '-r', 'lint']);
  }

  @func()
  public async typecheck(workspace: string): Promise<Container> {
    const container = await this.mountFiles(workspace, 'dev');

    return container.withExec(['vp', 'run', '-r', 'type-check']);
  }

  @func()
  public async build(workspace: string): Promise<Container> {
    const container = await this.mountFiles(workspace, 'dev');

    return container.withExec(['vp', 'run', '-r', 'build']);
  }

  @func()
  public async test(workspace: string): Promise<Container> {
    const container = await this.build(workspace);

    return container.withExec(['vp', 'run', '--filter', workspace, 'test']);
  }
}
