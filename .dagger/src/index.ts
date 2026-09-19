import {
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

import {
  install,
  mountDaggerFiles,
  mountFiles,
  prune,
  withInstalledRootSource,
} from './helpers/build';
import {
  BUILD_ARTIFACT_KEEP,
  CURL_IMAGE,
  DAGGER_WORKSPACE,
  DOCKER_CLI_VERSION,
  NGINX_IMAGE,
  ROOT_FILES,
  SEMGREP_EXCLUSIONS,
  SEMGREP_IMAGE,
  SEMGREP_RULESETS,
  SONAR_LOCAL_HOST_URL,
  SONAR_WORKING_DIRECTORY,
  SOURCE_IGNORE,
  VITE_PLUS_USER,
} from './helpers/constants';
import {
  isFrontend,
  outputDirectory,
  shortWorkspaceName,
  withBuildEnv,
  workspacePath,
} from './helpers/container';
import { attachSonarRow, coverageRow, semgrepRow } from './helpers/report';
import { localSonarRunner, remoteSonarRunner } from './helpers/sonar';

@object()
class Monorepo {
  public source: Directory;
  public rootSource: Directory;

  public constructor(
    @argument({ defaultPath: '/', ignore: SOURCE_IGNORE }) source: Directory,
    @argument({ defaultPath: '.dagger' }) daggerSource: Directory,
    @argument({ defaultPath: '.templates' }) templatesSource: Directory,
    @argument({ defaultPath: 'commitlint.config.ts' }) commitlintConfig: File,
    @argument({ defaultPath: 'plopfile.ts' }) plopfile: File,
    @argument({ defaultPath: 'dagger.json' }) daggerJson: File,
  ) {
    this.source = source;
    this.rootSource = source
      .withDirectory('.dagger', daggerSource)
      .withDirectory('.templates', templatesSource)
      .withFile('commitlint.config.ts', commitlintConfig)
      .withFile('plopfile.ts', plopfile)
      .withFile('dagger.json', daggerJson);
  }

  @func()
  public async madge(): Promise<Directory> {
    const container = withInstalledRootSource(this.rootSource);

    const stdout = await container.withExec(['vp', 'run', '-r', 'madge']).stdout();

    return outputDirectory('madge', stdout);
  }

  @func()
  public async root(): Promise<Directory> {
    const container = withInstalledRootSource(this.rootSource);

    const stdout = await container.withExec(['vp', 'run', '-r', 'root']).stdout();

    return outputDirectory('root', stdout);
  }

  @func()
  public async ready(): Promise<Directory> {
    const container = withInstalledRootSource(this.rootSource);

    const stdout = await container.withExec(['vp', 'run', 'ready']).stdout();

    return outputDirectory('ready', stdout);
  }

  private async mountWorkspaceFiles(workspace: string): Promise<Container> {
    if (workspace === DAGGER_WORKSPACE) {
      return mountDaggerFiles(this.rootSource);
    }
    return await mountFiles(this.source, workspace);
  }

  @func()
  public async check(workspace: string): Promise<Directory> {
    const container = await this.mountWorkspaceFiles(workspace);

    const execArgs =
      workspace === DAGGER_WORKSPACE
        ? ['vp', 'run', '-r', 'dagger:check']
        : ['vp', 'run', '-r', 'check'];
    const stdout = await container.withExec(execArgs).stdout();

    return outputDirectory('check', stdout);
  }

  @func()
  public async format(workspace: string): Promise<Directory> {
    const container = await this.mountWorkspaceFiles(workspace);

    const execArgs =
      workspace === DAGGER_WORKSPACE
        ? ['vp', 'run', '-r', 'dagger:format']
        : ['vp', 'run', '-r', 'format'];
    const stdout = await container.withExec(execArgs).stdout();

    return outputDirectory('format', stdout);
  }

  @func()
  public async lint(workspace: string): Promise<Directory> {
    const container = await this.mountWorkspaceFiles(workspace);

    const execArgs =
      workspace === DAGGER_WORKSPACE
        ? ['vp', 'run', '-r', 'dagger:lint']
        : ['vp', 'run', '-r', 'lint'];
    const stdout = await container.withExec(execArgs).stdout();

    return outputDirectory('lint', stdout);
  }

  @func()
  public async typeCheck(workspace: string): Promise<Directory> {
    const container = await this.mountWorkspaceFiles(workspace);

    const execArgs =
      workspace === DAGGER_WORKSPACE
        ? ['vp', 'run', '-r', 'dagger:type-check']
        : ['vp', 'run', '-r', 'type-check'];
    const stdout = await container.withExec(execArgs).stdout();

    return outputDirectory('type-check', stdout);
  }

  @func()
  public async build(workspace: string, buildEnv?: string[]): Promise<Container> {
    const container = await mountFiles(this.source, workspace);

    return withBuildEnv(container, workspace, buildEnv).withExec(['vp', 'run', '-r', 'build']);
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
    const isDagger = workspace === DAGGER_WORKSPACE;

    const container = isDagger
      ? mountDaggerFiles(this.rootSource)
      : await this.build(workspace, buildEnv);

    const testExecArgs = isDagger
      ? ['vp', 'run', '-r', 'dagger:test']
      : ['vp', 'run', '--filter', workspace, 'test'];
    const testContainer = container.withExec(testExecArgs, { expect: ReturnType.Any });

    const [exitCode, stdout] = await Promise.all([
      testContainer.exitCode(),
      testContainer.stdout(),
    ]);

    let result = outputDirectory('test', stdout).withNewFile('test.exit-code', `${exitCode}`);

    const workspaceDir = isDagger ? '.dagger' : workspacePath(workspace);
    const coveragePath = `/app/${workspaceDir}/coverage`;
    const shortName = isDagger ? DAGGER_WORKSPACE : shortWorkspaceName(workspaceDir);

    const coverageDir = testContainer.directory(coveragePath);
    let summaryJson: string | undefined = undefined;
    try {
      await coverageDir.entries();
      result = result.withDirectory('coverage', coverageDir);
      summaryJson = await coverageDir.file('coverage-summary.json').contents();
    } catch {
      // No coverage report to attach.
    }

    return result.withNewFile('test.row.md', coverageRow(shortName, summaryJson));
  }

  @func()
  public async semgrep(workspace: string): Promise<Directory> {
    const workspaceDir = workspacePath(workspace);

    const scanRoot = dag
      .directory()
      .withDirectory(workspaceDir, this.source.directory(workspaceDir));

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

    let result = outputDirectory('semgrep', stdout).withNewFile('semgrep.exit-code', `${exitCode}`);

    const sarif = scanContainer.file('/repo/semgrep.sarif');
    let sarifJson: string | undefined = undefined;
    try {
      sarifJson = await sarif.contents();
      result = result.withFile('semgrep.sarif', sarif);
    } catch {
      // No SARIF report to attach.
    }

    const shortName = shortWorkspaceName(workspaceDir);
    return result.withNewFile('semgrep.row.md', semgrepRow(shortName, sarifJson));
  }

  @func()
  public async sonar(
    workspace: string,
    sonarToken: Secret,
    dockerSocket?: Socket,
    sonarHostUrl?: string,
  ): Promise<Directory> {
    const workspaceDir = workspacePath(workspace);
    const shortName = shortWorkspaceName(workspaceDir);
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
      .withDirectory(workspaceDir, this.source.directory(workspaceDir))
      .withFile('sonar-project.properties', this.source.file('sonar-project.properties'))
      .withFile('pnpm-workspace.yaml', this.source.file('pnpm-workspace.yaml'))
      .withFile('package.json', this.source.file('package.json'));

    const coverageDir = testResult.directory('coverage');
    try {
      await coverageDir.entries();
      scanRoot = scanRoot.withDirectory(`${workspaceDir}/coverage`, coverageDir);
    } catch {
      // No coverage report; Sonar will just report 0% new coverage for this run.
    }

    const sonarArgs = [
      `-Dsonar.projectKey=${projectKey}`,
      `-Dsonar.projectName='Vite+ Monorepo - ${shortName}'`,
      `-Dsonar.sources=${workspaceDir}`,
      `-Dsonar.javascript.lcov.reportPaths=${workspaceDir}/coverage/lcov.info`,
      '-Dsonar.qualitygate.wait=true',
      `-Dsonar.working.directory=${SONAR_WORKING_DIRECTORY}`,
    ].join(' ');

    const { container: runnerContainer, reportTaskPath } =
      useLocalNetwork && dockerSocket !== undefined
        ? localSonarRunner(dockerSocket, scanRoot, sonarToken, hostUrl, sonarArgs, projectKey)
        : remoteSonarRunner(scanRoot, sonarToken, hostUrl, sonarArgs);

    const [stdout, exitCodeText] = await Promise.all([
      runnerContainer.stdout(),
      runnerContainer.file('/tmp/sonar.exit-code').contents(),
    ]);

    let result = outputDirectory('sonar', stdout).withNewFile(
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

      return attachSonarRow(result, shortName);
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

    return attachSonarRow(result, shortName);
  }

  @func()
  public async nginx(workspace: string, buildEnv?: string[]): Promise<Container> {
    const buildContainer = await this.build(workspace, buildEnv);

    const workspaceDir = workspacePath(workspace);
    const workspaceContainerDir = buildContainer.directory(`/app/${workspaceDir}`);
    const entries = await workspaceContainerDir.entries();

    let container = dag
      .container()
      .from(NGINX_IMAGE)
      .withExec(['rm', '/etc/nginx/conf.d/default.conf'])
      .withFile('/etc/nginx/conf.d/nginx.conf', this.source.file(`${workspaceDir}/nginx.conf`))
      .withExposedPort(80);

    for (const artifactDir of ['out', 'dist']) {
      if (entries.includes(`${artifactDir}/`)) {
        container = container.withDirectory(
          '/usr/share/nginx/html/vite',
          workspaceContainerDir.directory(artifactDir),
        );
        break;
      }
    }

    if (entries.includes('storybook-static/')) {
      container = container
        .withDirectory(
          '/usr/share/nginx/html/storybook',
          workspaceContainerDir.directory('storybook-static'),
        )
        .withExposedPort(81);
    }

    return withBuildEnv(container, workspace, buildEnv).withDefaultArgs([
      'nginx',
      '-g',
      'daemon off;',
    ]);
  }

  @func()
  public async vp(workspace: string, buildEnv?: string[]): Promise<Container> {
    const buildContainer = await this.build(workspace, buildEnv);

    const pruned = await prune(this.source, workspace);
    let container = install(this.source, pruned, 'prod');

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

    const workspaceDir = workspacePath(workspace);

    return withBuildEnv(container, workspace, buildEnv)
      .withWorkdir(`/app/${workspaceDir}`)
      .withDefaultArgs(['node', 'dist/index.mjs']);
  }

  @func()
  public async load(
    workspace: string,
    dockerSocket: Socket,
    tag?: string,
    buildEnv?: string[],
  ): Promise<string> {
    const container = isFrontend(workspace)
      ? await this.nginx(workspace, buildEnv)
      : await this.vp(workspace, buildEnv);

    const workspaceDir = workspacePath(workspace);
    const imageName = shortWorkspaceName(workspaceDir);

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
    const container = isFrontend(workspace)
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
    cloudflareAccountId: Secret,
    buildEnv?: string[],
  ): Promise<string> {
    const container = await this.build(workspace, buildEnv);

    const workspaceDir = workspacePath(workspace);

    const deployContainer = container
      .withWorkdir(`/app/${workspaceDir}`)
      .withSecretVariable('CLOUDFLARE_API_TOKEN', cloudflareApiToken)
      .withSecretVariable('CLOUDFLARE_ACCOUNT_ID', cloudflareAccountId);

    return withBuildEnv(deployContainer, workspace, buildEnv)
      .withExec(['vp', 'run', '--filter', workspace, 'wrangler:deploy'])
      .stdout();
  }
}

export { Monorepo };
