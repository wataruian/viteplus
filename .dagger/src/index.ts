import {
  CacheSharingMode,
  type Container,
  type Directory,
  type File,
  ReturnType,
  type Secret,
  type Socket,
  argument,
  dag,
  func,
  object,
} from '@dagger.io/dagger';

const VITE_PLUS_IMAGE = 'ghcr.io/voidzero-dev/vite-plus:0.3.1';
const VITE_PLUS_USER = 'vp';
const VITE_PLUS_PACKAGE_MANAGER_PATH = '/home/vp/.vite-plus/package_manager';
const VITE_PLUS_JS_RUNTIME_PATH = '/home/vp/.vite-plus/js_runtime';
const PNPM_STORE_PATH = '/home/vp/.local/share/pnpm/store';
const TASK_CACHE_PATH = '/app/node_modules/.vite/task-cache';

const NGINX_IMAGE = 'nginx:1.27.0-alpine';
const DOCKER_CLI_VERSION = 'docker:27.5.1-cli';
const SEMGREP_IMAGE = 'semgrep/semgrep:1.177.0';
const SONAR_SCANNER_IMAGE = 'sonarsource/sonar-scanner-cli:12.1.0.3233_8.0.1';
const SONAR_SCANNER_USER = 'scanner-cli';
const SONAR_WORKING_DIRECTORY = '/tmp/.scannerwork';
const CURL_IMAGE = 'curlimages/curl:8.14.1';
const SONAR_LOCAL_HOST_URL = 'http://sonarqube:9000';
const SONAR_LOCAL_DOCKER_NETWORK = 'viteplus-net';

const SEMGREP_RULESETS = [
  '--config=p/security-audit',
  '--config=p/owasp-top-ten',
  '--config=p/javascript',
  '--config=p/typescript',
  '--config=p/react',
];

const SEMGREP_EXCLUSIONS = [
  '--exclude-rule=yaml.github-actions.security.github-actions-mutable-action-tag.github-actions-mutable-action-tag',
  '--exclude-rule=package_managers.renovate.renovate-missing-minimum-release-age.renovate-missing-minimum-release-age',
  '--exclude-rule=yaml.docker-compose.security.privileged-service.privileged-service',
  '--exclude-rule=package_managers.pnpm.pnpm-trust-policy.pnpm-trust-policy',
  '--exclude-rule=package_managers.pnpm.pnpm-missing-minimum-release-age.pnpm-minimum-release-age',
  '--exclude-rule=package_managers.pnpm.pnpm-block-exotic-sub-dependencies.pnpm-block-exotic-sub-dependencies',
  '--exclude-rule=package_managers.npm.npm-missing-minimum-release-age.npm-missing-minimum-release-age',
  '--exclude-rule=generic.html-templates.security.unquoted-attribute-var.unquoted-attribute-var',
];

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

const WORKSPACES: Record<string, { isFrontend: boolean; path: string } | undefined> = {
  '@lightproject/backend': { isFrontend: false, path: 'apps/backend' },
  '@lightproject/common': { isFrontend: false, path: 'packages/common' },
  '@lightproject/design-system': { isFrontend: true, path: 'packages/design-system' },
  '@lightproject/frontend': { isFrontend: true, path: 'apps/frontend' },
  '@lightproject/library': { isFrontend: false, path: 'packages/library' },
};

const WORKSPACE_NAMES = Object.keys(WORKSPACES);

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

  private static workspace(workspace: string): { isFrontend: boolean; path: string } {
    const entry = WORKSPACES[workspace];
    if (!entry) {
      throw new Error(`Workspace ${workspace} is not supported`);
    }

    return entry;
  }

  private static workspacePath(workspace: string): string {
    return Monorepo.workspace(workspace).path;
  }

  private static isFrontend(workspace: string): boolean {
    return Monorepo.workspace(workspace).isFrontend;
  }

  private static outputDirectory(taskName: string, content: string): Directory {
    return dag.directory().withNewFile(`${taskName}.output`, content);
  }

  private static installArgs(mode: 'dev' | 'prod' = 'dev'): string[] {
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
    return Monorepo.withTaskCache(this.withRootSource().withExec(Monorepo.installArgs()), 'root');
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

  private install(pruned: Container, mode: 'dev' | 'prod' = 'dev'): Container {
    const rootFiles = this.source.filter({ include: ROOT_FILES });
    const prunedJson = pruned.directory('.pruned/json');
    const combined = rootFiles.withDirectory('/', prunedJson);

    return Monorepo.withInstallCaches(
      dag
        .container()
        .from(VITE_PLUS_IMAGE)
        .withWorkdir('/app')
        .withDirectory('/app', combined, { owner: VITE_PLUS_USER }),
    ).withExec(Monorepo.installArgs(mode));
  }

  private async mountFiles(workspace: string, mode: 'dev' | 'prod' = 'dev'): Promise<Container> {
    const pruned = await this.prune(workspace);
    const installContainer = this.install(pruned, mode);

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
  public async ready(): Promise<Directory> {
    const container = this.withInstalledRootSource();

    const stdout = await container.withExec(['vp', 'run', 'ready']).stdout();

    return Monorepo.outputDirectory('ready', stdout);
  }

  @func()
  public async check(workspace: string): Promise<Directory> {
    const container = await this.mountFiles(workspace);

    const stdout = await container.withExec(['vp', 'run', '-r', 'check']).stdout();

    return Monorepo.outputDirectory('check', stdout);
  }

  @func()
  public async format(workspace: string): Promise<Directory> {
    const container = await this.mountFiles(workspace);

    const stdout = await container.withExec(['vp', 'run', '-r', 'format']).stdout();

    return Monorepo.outputDirectory('format', stdout);
  }

  @func()
  public async lint(workspace: string): Promise<Directory> {
    const container = await this.mountFiles(workspace);

    const stdout = await container.withExec(['vp', 'run', '-r', 'lint']).stdout();

    return Monorepo.outputDirectory('lint', stdout);
  }

  @func()
  public async typeCheck(workspace: string): Promise<Directory> {
    const container = await this.mountFiles(workspace);

    const stdout = await container.withExec(['vp', 'run', '-r', 'type-check']).stdout();

    return Monorepo.outputDirectory('type-check', stdout);
  }

  @func()
  public async build(workspace: string, buildEnv?: string[]): Promise<Container> {
    const container = await this.mountFiles(workspace);

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
      'for group in apps packages; do',
      '  [ -d "/app/$group" ] || continue',
      '  for pkg in "/app/$group"/*/; do',
      '    [ -d "$pkg" ] || continue',
      `    find "$pkg" -mindepth 1 -maxdepth 1 ${pruneArgs} -exec rm -rf {} +`,
      '  done',
      'done',
    ].join('\n');

    return buildContainer
      .withExec(['sh', '-c', script])
      .directory('/app')
      .filter({ exclude: ['node_modules'] });
  }

  @func()
  public async test(workspace: string, buildEnv?: string[]): Promise<Directory> {
    const container = await this.build(workspace, buildEnv);

    const testContainer = container.withExec(['vp', 'run', '--filter', workspace, 'test'], {
      expect: ReturnType.Any,
    });

    const workspacePath = Monorepo.workspacePath(workspace);

    const [exitCode, stdout] = await Promise.all([
      testContainer.exitCode(),
      testContainer.stdout(),
    ]);

    let result = Monorepo.outputDirectory('test', stdout).withNewFile(
      'test.exit-code',
      `${exitCode}`,
    );

    const coverageDir = testContainer.directory(`/app/${workspacePath}/coverage`);
    try {
      await coverageDir.entries();
      result = result.withDirectory('coverage', coverageDir);
    } catch {
      // No coverage report to attach.
    }

    return result;
  }

  @func()
  public async semgrep(workspace: string): Promise<Directory> {
    const workspacePath = Monorepo.workspacePath(workspace);

    const scanRoot = dag
      .directory()
      .withDirectory(workspacePath, this.source.directory(workspacePath));

    const semgrepCommand = [
      'semgrep',
      'scan',
      ...SEMGREP_RULESETS,
      ...SEMGREP_EXCLUSIONS,
      '--error',
      '--sarif',
      '--output=/repo/semgrep.sarif',
      '/repo',
    ].join(' ');

    const scanContainer = dag
      .container()
      .from(SEMGREP_IMAGE)
      .withWorkdir('/repo')
      .withDirectory('/repo', scanRoot)
      .withExec(['sh', '-c', `${semgrepCommand} 2>&1`], { expect: ReturnType.Any });

    const [exitCode, stdout] = await Promise.all([
      scanContainer.exitCode(),
      scanContainer.stdout(),
    ]);

    let result = Monorepo.outputDirectory('semgrep', stdout).withNewFile(
      'semgrep.exit-code',
      `${exitCode}`,
    );

    const sarif = scanContainer.file('/repo/semgrep.sarif');
    try {
      await sarif.contents();
      result = result.withFile('semgrep.sarif', sarif);
    } catch {
      // No SARIF report to attach.
    }

    return result;
  }

  private static localSonarRunner(
    dockerSocket: Socket,
    scanRoot: Directory,
    sonarToken: Secret,
    hostUrl: string,
    sonarArgs: string,
    projectKey: string,
  ): { container: Container; reportTaskPath: string } {
    const pollScript = [
      'set -eu',
      'task_status=""',
      'i=0',
      'while [ "$i" -lt 30 ]; do',
      `  task_json=$(curl -s -u "\${SONAR_TOKEN}:" "\${SONAR_HOST_URL}/api/ce/task?id=\${CE_TASK_ID}")`,
      `  task_status=$(echo "$task_json" | grep -o '"status":"[A-Z]*"' | head -1 | cut -d'"' -f4)`,
      '  case "$task_status" in',
      '    SUCCESS|FAILED|CANCELED) break ;;',
      '  esac',
      '  i=$((i + 1))',
      '  sleep 3',
      'done',
      'echo "$task_json" > /tmp/ce-task.json',
      `analysis_id=$(echo "$task_json" | grep -o '"analysisId":"[^"]*"' | cut -d'"' -f4 || true)`,
      'if [ -n "$analysis_id" ]; then',
      `  curl -s -u "\${SONAR_TOKEN}:" "\${SONAR_HOST_URL}/api/qualitygates/project_status?analysisId=\${analysis_id}" > /tmp/sonar-quality-gate.json`,
      'fi',
      `curl -s -u "\${SONAR_TOKEN}:" "\${SONAR_HOST_URL}/api/issues/search?componentKeys=${projectKey}&resolved=false&ps=50" > /tmp/sonar-issues.json`,
    ].join('\n');

    const orchestrationScript = [
      'set -eu',
      `container_id=$(docker create --network ${SONAR_LOCAL_DOCKER_NETWORK} -e SONAR_HOST_URL -e SONAR_TOKEN -w /usr/src ${SONAR_SCANNER_IMAGE} sonar-scanner ${sonarArgs})`,
      `docker cp /usr/src/. "\${container_id}:/usr/src"`,
      `docker start "\${container_id}" >/dev/null`,
      `docker logs -f "\${container_id}" 2>&1`,
      `exit_code=$(docker wait "\${container_id}")`,
      `docker cp "\${container_id}:${SONAR_WORKING_DIRECTORY}/report-task.txt" /tmp/report-task.txt 2>/dev/null || true`,
      `docker rm "\${container_id}" >/dev/null`,
      `echo "\${exit_code}" > /tmp/sonar.exit-code`,
      '',
      'if [ -f /tmp/report-task.txt ]; then',
      `  ce_task_id=$(grep "^ceTaskId=" /tmp/report-task.txt | cut -d= -f2-)`,
      `  poll_id=$(docker create --network ${SONAR_LOCAL_DOCKER_NETWORK} -e SONAR_HOST_URL -e SONAR_TOKEN -e CE_TASK_ID="\${ce_task_id}" --entrypoint sh ${CURL_IMAGE} /poll.sh)`,
      `  docker cp /poll.sh "\${poll_id}:/poll.sh"`,
      `  docker start -a "\${poll_id}" || true`,
      `  docker cp "\${poll_id}:/tmp/sonar-quality-gate.json" /tmp/sonar-quality-gate.json 2>/dev/null || true`,
      `  docker cp "\${poll_id}:/tmp/sonar-issues.json" /tmp/sonar-issues.json 2>/dev/null || true`,
      `  docker rm "\${poll_id}" >/dev/null`,
      'fi',
    ].join('\n');

    const container = dag
      .container()
      .from(DOCKER_CLI_VERSION)
      .withUnixSocket('/var/run/docker.sock', dockerSocket)
      .withNewFile('/poll.sh', pollScript)
      .withWorkdir('/usr/src')
      .withDirectory('/usr/src', scanRoot)
      .withEnvVariable('SONAR_HOST_URL', hostUrl)
      .withSecretVariable('SONAR_TOKEN', sonarToken)
      .withExec(['sh', '-c', orchestrationScript]);

    return { container, reportTaskPath: '/tmp/report-task.txt' };
  }

  private static remoteSonarRunner(
    scanRoot: Directory,
    sonarToken: Secret,
    hostUrl: string,
    sonarArgs: string,
  ): { container: Container; reportTaskPath: string } {
    const container = dag
      .container()
      .from(SONAR_SCANNER_IMAGE)
      .withWorkdir('/usr/src')
      .withDirectory('/usr/src', scanRoot, { owner: SONAR_SCANNER_USER })
      .withSecretVariable('SONAR_TOKEN', sonarToken)
      .withEnvVariable('SONAR_HOST_URL', hostUrl)
      .withExec(['sh', '-c', `sonar-scanner ${sonarArgs} 2>&1; echo $? > /tmp/sonar.exit-code`], {
        expect: ReturnType.Any,
      });

    return { container, reportTaskPath: `${SONAR_WORKING_DIRECTORY}/report-task.txt` };
  }

  @func()
  public async sonar(
    workspace: string,
    sonarToken: Secret,
    dockerSocket?: Socket,
    sonarHostUrl?: string,
  ): Promise<Directory> {
    const workspacePath = Monorepo.workspacePath(workspace);
    const shortName = workspacePath.split('/').pop() ?? workspace;
    const projectKey = `lightproject-viteplus-${shortName}`;
    const hostUrl = sonarHostUrl ?? SONAR_LOCAL_HOST_URL;
    const useLocalNetwork = hostUrl === SONAR_LOCAL_HOST_URL;

    if (useLocalNetwork && dockerSocket === undefined) {
      throw new Error(
        'dockerSocket is required for the local SonarQube target (pass sonarHostUrl for a remote instance instead)',
      );
    }

    const testResult = await this.test(workspace);

    let scanRoot = this.source
      .filter({ include: ROOT_FILES })
      .withDirectory(workspacePath, this.source.directory(workspacePath))
      .withFile('sonar-project.properties', this.source.file('sonar-project.properties'))
      .withFile('pnpm-workspace.yaml', this.source.file('pnpm-workspace.yaml'))
      .withFile('package.json', this.source.file('package.json'));

    const coverageDir = testResult.directory('coverage');
    try {
      await coverageDir.entries();
      scanRoot = scanRoot.withDirectory(`${workspacePath}/coverage`, coverageDir);
    } catch {
      // No coverage report; Sonar will just report 0% new coverage for this run.
    }

    const sonarArgs = [
      `-Dsonar.projectKey=${projectKey}`,
      `-Dsonar.projectName='Vite+ Monorepo - ${shortName}'`,
      `-Dsonar.sources=${workspacePath}`,
      `-Dsonar.javascript.lcov.reportPaths=${workspacePath}/coverage/lcov.info`,
      '-Dsonar.qualitygate.wait=true',
      `-Dsonar.working.directory=${SONAR_WORKING_DIRECTORY}`,
    ].join(' ');

    const { container: runnerContainer, reportTaskPath } =
      useLocalNetwork && dockerSocket !== undefined
        ? Monorepo.localSonarRunner(
            dockerSocket,
            scanRoot,
            sonarToken,
            hostUrl,
            sonarArgs,
            projectKey,
          )
        : Monorepo.remoteSonarRunner(scanRoot, sonarToken, hostUrl, sonarArgs);

    const [stdout, exitCodeText] = await Promise.all([
      runnerContainer.stdout(),
      runnerContainer.file('/tmp/sonar.exit-code').contents(),
    ]);

    let result = Monorepo.outputDirectory('sonar', stdout).withNewFile(
      'sonar.exit-code',
      exitCodeText.trim(),
    );

    if (useLocalNetwork) {
      const reportFiles: [string, string][] = [
        ['sonar-quality-gate.json', '/tmp/sonar-quality-gate.json'],
        ['sonar-issues.json', '/tmp/sonar-issues.json'],
      ];

      const availableFiles = await Promise.all(
        reportFiles.map(async ([fileName, path]) => {
          const file = runnerContainer.file(path);
          try {
            await file.contents();
            return { file, fileName };
          } catch {
            return undefined;
          }
        }),
      );

      for (const entry of availableFiles) {
        if (entry !== undefined) {
          result = result.withFile(entry.fileName, entry.file);
        }
      }

      return result;
    }

    const reportTask = runnerContainer.file(reportTaskPath);
    let reportTaskContents: string | undefined = undefined;
    try {
      reportTaskContents = await reportTask.contents();
    } catch {
      // Scanner failed before producing a report-task.txt; nothing more to fetch.
    }

    const ceTaskId =
      reportTaskContents === undefined
        ? undefined
        : /^ceTaskId=(?<id>.+)$/mu.exec(reportTaskContents)?.groups?.id;

    if (ceTaskId !== undefined) {
      const script = [
        'set -eu',
        'task_status=""',
        'i=0',
        'while [ "$i" -lt 30 ]; do',
        `  task_json=$(curl -s -u "\${SONAR_TOKEN}:" "\${SONAR_HOST_URL}/api/ce/task?id=${ceTaskId}")`,
        `  task_status=$(echo "$task_json" | grep -o '"status":"[A-Z]*"' | head -1 | cut -d'"' -f4)`,
        '  case "$task_status" in',
        '    SUCCESS|FAILED|CANCELED) break ;;',
        '  esac',
        '  i=$((i + 1))',
        '  sleep 3',
        'done',
        'echo "$task_json" > /tmp/ce-task.json',
        `analysis_id=$(echo "$task_json" | grep -o '"analysisId":"[^"]*"' | cut -d'"' -f4 || true)`,
        'if [ -n "$analysis_id" ]; then',
        `  curl -s -u "\${SONAR_TOKEN}:" "\${SONAR_HOST_URL}/api/qualitygates/project_status?analysisId=\${analysis_id}" > /tmp/sonar-quality-gate.json`,
        'fi',
        `curl -s -u "\${SONAR_TOKEN}:" "\${SONAR_HOST_URL}/api/issues/search?componentKeys=${projectKey}&resolved=false&ps=50" > /tmp/sonar-issues.json`,
      ].join('\n');

      const pollContainer = dag
        .container()
        .from(CURL_IMAGE)
        .withSecretVariable('SONAR_TOKEN', sonarToken)
        .withEnvVariable('SONAR_HOST_URL', hostUrl)
        .withExec(['sh', '-c', script]);

      const reportFiles: [string, string][] = [
        ['sonar-quality-gate.json', '/tmp/sonar-quality-gate.json'],
        ['sonar-issues.json', '/tmp/sonar-issues.json'],
      ];

      const availableFiles = await Promise.all(
        reportFiles.map(async ([fileName, path]) => {
          const file = pollContainer.file(path);
          try {
            await file.contents();
            return { file, fileName };
          } catch {
            return undefined;
          }
        }),
      );

      for (const entry of availableFiles) {
        if (entry !== undefined) {
          result = result.withFile(entry.fileName, entry.file);
        }
      }
    }

    return result;
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

    const pruned = await this.prune(workspace);
    let container = this.install(pruned, 'prod');

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

  private async deploymentContainer(workspace: string, buildEnv?: string[]): Promise<Container> {
    return Monorepo.isFrontend(workspace)
      ? await this.nginx(workspace, buildEnv)
      : await this.vp(workspace, buildEnv);
  }

  @func()
  public async load(
    workspace: string,
    dockerSocket: Socket,
    tag?: string,
    buildEnv?: string[],
  ): Promise<string> {
    const container = await this.deploymentContainer(workspace, buildEnv);

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
    const container = await this.deploymentContainer(workspace, buildEnv);

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
