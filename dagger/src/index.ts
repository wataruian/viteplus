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
  DAGGER_WORKSPACE,
  DATABASE_DIALECTS,
  DOCKER_CLI_IMAGE,
  NGINX_IMAGE,
  ROOT_FILES,
  SEMGREP_EXCLUSIONS,
  SEMGREP_IMAGE,
  SEMGREP_RULESETS,
  SONAR_LOCAL_HOST_URL,
  SONAR_WORKING_DIRECTORY,
  SOURCE_IGNORE,
  VITE_PLUS_JS_RUNTIME_PATH,
  VITE_PLUS_USER,
  WORKSPACE_GROUPS,
  WORKSPACE_NAMES,
} from './helpers/constants';
import {
  assertDeployEnvironment,
  isFrontend,
  outputDirectory,
  postgresUrlVariable,
  shortWorkspaceName,
  withBuildEnv,
  withPlaywrightChromium,
  withPostgres,
  withoutProxy,
  workerVarArgs,
  workspaceImage,
  workspacePath,
} from './helpers/container';
import { attachSonarRow, coverageRow, e2eRow, semgrepRow } from './helpers/report';
import {
  LOCAL_ORCHESTRATOR_HOME,
  POLL_CONTAINER_HOME,
  attachReportFiles,
  localSonarRunner,
  pollQualityGate,
  remoteSonarRunner,
  sonarCleanupRunner,
  sonarProject,
} from './helpers/sonar';

@object()
export class Monorepo {
  public source: Directory;
  public rootSource: Directory;

  public constructor(
    @argument({ defaultPath: '/', ignore: SOURCE_IGNORE }) source: Directory,
    @argument({ defaultPath: 'dagger' }) daggerSource: Directory,
    @argument({ defaultPath: 'scaffold' }) templatesSource: Directory,
    @argument({ defaultPath: 'commitlint.config.ts' }) commitlintConfig: File,
    @argument({ defaultPath: 'plopfile.ts' }) plopfile: File,
    @argument({ defaultPath: 'dagger.json' }) daggerJson: File,
  ) {
    this.source = source;
    this.rootSource = source
      .withDirectory('dagger', daggerSource)
      .withDirectory('scaffold', templatesSource)
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

    const checked = container.withExec(['vp', 'run', '-r', 'root:check']);
    const tested = checked.withExec(['vp', 'run', '-r', 'root:test:unit']);
    const stdout = `${await checked.stdout()}${await tested.stdout()}`;

    return outputDirectory('root', stdout);
  }

  @func()
  public async ready(): Promise<Directory> {
    const container = withPostgres(withInstalledRootSource(this.rootSource), WORKSPACE_NAMES);

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
      `for group in ${WORKSPACE_GROUPS.join(' ')}; do`,
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
  public async testUnit(workspace: string, buildEnv?: string[]): Promise<Directory> {
    const isDagger = workspace === DAGGER_WORKSPACE;

    const container = isDagger
      ? mountDaggerFiles(this.rootSource)
      : await this.build(workspace, buildEnv);

    const testExecArgs = isDagger
      ? ['vp', 'run', '-r', 'dagger:test:unit']
      : ['vp', 'run', '--filter', workspace, 'test:unit'];
    const testContainer = container.withExec(testExecArgs, { expect: ReturnType.Any });

    const [exitCode, stdout] = await Promise.all([
      testContainer.exitCode(),
      testContainer.stdout(),
    ]);

    let result = outputDirectory('test-unit', stdout).withNewFile(
      'test-unit.exit-code',
      `${exitCode}`,
    );

    const workspaceDir = isDagger ? 'dagger' : workspacePath(workspace);
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

    return result.withNewFile('test-unit.row.md', coverageRow(shortName, summaryJson));
  }

  @func()
  public async testIntegration(workspace: string): Promise<Directory> {
    const workspaceDir = workspacePath(workspace);
    const workspaceEntries = await this.source.directory(workspaceDir).entries();
    const testEntries = workspaceEntries.includes('tests/')
      ? await this.source.directory(`${workspaceDir}/tests`).entries()
      : [];
    if (!testEntries.includes('integration/')) {
      throw new Error(`Workspace ${workspace} has no integration tests (tests/integration)`);
    }

    const container = withPostgres(await this.build(workspace), [workspace]);
    const testContainer = container.withExec(
      ['vp', 'run', '--filter', workspace, 'test:integration'],
      { expect: ReturnType.Any },
    );

    const [exitCode, stdout] = await Promise.all([
      testContainer.exitCode(),
      testContainer.stdout(),
    ]);

    return outputDirectory('test-integration', stdout).withNewFile(
      'test-integration.exit-code',
      `${exitCode}`,
    );
  }

  @func()
  public async testEndToEnd(workspace: string): Promise<Directory> {
    const workspaceDir = workspacePath(workspace);
    const workspaceEntries = await this.source.directory(workspaceDir).entries();
    if (!workspaceEntries.includes('playwright.config.ts')) {
      throw new Error(`Workspace ${workspace} has no Playwright e2e tests (playwright.config.ts)`);
    }

    const container = withPlaywrightChromium(await mountFiles(this.source, workspace), workspace);
    const e2eContainer = container.withExec(['vp', 'run', '--filter', workspace, 'test:e2e'], {
      expect: ReturnType.Any,
    });

    const [exitCode, stdout] = await Promise.all([e2eContainer.exitCode(), e2eContainer.stdout()]);

    let result = outputDirectory('test-end-to-end', stdout).withNewFile(
      'test-end-to-end.exit-code',
      `${exitCode}`,
    );

    const e2eDir = e2eContainer.directory(`/app/${workspaceDir}/e2e-test-results`);
    let resultsJson: string | undefined = undefined;
    try {
      await e2eDir.entries();
      result = result.withDirectory('e2e-test-results', e2eDir);
      resultsJson = await e2eDir.file('results.json').contents();
    } catch {
      // No Playwright output to attach (e.g. the web server never started).
    }

    return result.withNewFile(
      'test-end-to-end.row.md',
      e2eRow(shortWorkspaceName(workspaceDir), resultsJson),
    );
  }

  @func()
  public async semgrep(workspace: string): Promise<Directory> {
    const isDagger = workspace === DAGGER_WORKSPACE;
    const workspaceDir = isDagger ? 'dagger' : workspacePath(workspace);
    const sourceRoot = isDagger ? this.rootSource : this.source;

    const scanRoot = dag
      .directory()
      .withDirectory(workspaceDir, sourceRoot.directory(workspaceDir));

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

    const shortName = isDagger ? DAGGER_WORKSPACE : shortWorkspaceName(workspaceDir);
    return result.withNewFile('semgrep.row.md', semgrepRow(shortName, sarifJson));
  }

  @func()
  public async sonar(
    workspace: string,
    sonarToken: Secret,
    dockerSocket?: Socket,
    sonarHostUrl?: string,
    branch?: string,
    pullRequest?: string,
  ): Promise<Directory> {
    const isDagger = workspace === DAGGER_WORKSPACE;
    const workspaceDir = isDagger ? 'dagger' : workspacePath(workspace);
    const shortName = isDagger ? DAGGER_WORKSPACE : shortWorkspaceName(workspaceDir);
    const project = sonarProject(shortName, { branch, pullRequest });
    const hostUrl = sonarHostUrl ?? SONAR_LOCAL_HOST_URL;
    const useLocalNetwork = hostUrl === SONAR_LOCAL_HOST_URL;

    if (useLocalNetwork && dockerSocket === undefined) {
      throw new Error(
        'dockerSocket is required for the local SonarQube target (pass sonarHostUrl for a remote instance instead)',
      );
    }

    const testResult = await this.testUnit(workspace);
    const sourceRoot = isDagger ? this.rootSource : this.source;

    let scanRoot = this.source
      .filter({ include: ROOT_FILES })
      .withDirectory(workspaceDir, sourceRoot.directory(workspaceDir))
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
      `-Dsonar.projectKey=${project.key}`,
      `-Dsonar.projectName='${project.name}'`,
      `-Dsonar.sources=${workspaceDir}`,
      `-Dsonar.javascript.lcov.reportPaths=${workspaceDir}/coverage/lcov.info`,
      '-Dsonar.qualitygate.wait=true',
      `-Dsonar.working.directory=${SONAR_WORKING_DIRECTORY}`,
    ].join(' ');

    const {
      container: runnerContainer,
      reportTaskPath,
      exitCodePath,
    } = useLocalNetwork && dockerSocket !== undefined
      ? localSonarRunner(dockerSocket, scanRoot, sonarToken, hostUrl, sonarArgs, project.key)
      : remoteSonarRunner(scanRoot, sonarToken, hostUrl, sonarArgs);

    const [stdout, exitCodeText] = await Promise.all([
      runnerContainer.stdout(),
      runnerContainer.file(exitCodePath).contents(),
    ]);

    let result = outputDirectory('sonar', stdout).withNewFile(
      'sonar.exit-code',
      exitCodeText.trim(),
    );

    if (useLocalNetwork) {
      result = await attachReportFiles(runnerContainer, LOCAL_ORCHESTRATOR_HOME, result);
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
      const pollContainer = pollQualityGate(sonarToken, hostUrl, project.key, ceTaskId);
      result = await attachReportFiles(pollContainer, POLL_CONTAINER_HOME, result);
    }

    return attachSonarRow(result, shortName);
  }

  @func()
  public async sonarCleanup(
    pullRequest: string,
    sonarToken: Secret,
    dockerSocket?: Socket,
    sonarHostUrl?: string,
  ): Promise<string> {
    const hostUrl = sonarHostUrl ?? SONAR_LOCAL_HOST_URL;
    const useLocalNetwork = hostUrl === SONAR_LOCAL_HOST_URL;

    if (useLocalNetwork && dockerSocket === undefined) {
      throw new Error(
        'dockerSocket is required for the local SonarQube target (pass sonarHostUrl for a remote instance instead)',
      );
    }

    const groupEntries = await Promise.all(
      WORKSPACE_GROUPS.map(async (group) => await this.source.directory(group).entries()),
    );
    const shortNames = [
      ...groupEntries
        .flat()
        .filter((entry) => entry.endsWith('/'))
        .map((entry) => entry.slice(0, -1)),
      DAGGER_WORKSPACE,
    ];
    const projectKeys = shortNames.map((name) => sonarProject(name, { pullRequest }).key);

    return await sonarCleanupRunner(
      projectKeys,
      sonarToken,
      hostUrl,
      useLocalNetwork ? dockerSocket : undefined,
    ).stdout();
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
    const groups = WORKSPACE_GROUPS.filter((group) => rootEntries.includes(`${group}/`));

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
    const { command, files } = workspaceImage(workspace);

    const sourceEntries =
      files.length > 0 ? await this.source.directory(workspaceDir).entries() : [];
    for (const name of files) {
      const target = `/app/${workspaceDir}/${name}`;
      const sourcePath = `${workspaceDir}/${name}`;
      container = sourceEntries.includes(`${name}/`)
        ? container.withDirectory(target, this.source.directory(sourcePath), {
            owner: VITE_PLUS_USER,
          })
        : container.withFile(target, this.source.file(sourcePath), { owner: VITE_PLUS_USER });
    }

    return withBuildEnv(container, workspace, buildEnv)
      .withWorkdir(`/app/${workspaceDir}`)
      .withoutMount(VITE_PLUS_JS_RUNTIME_PATH)
      .withExec(['node', '--version'])
      .withDefaultArgs(command);
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

    const imageTarPath = '/root/image.tar';

    const script = [
      'set -eu',
      `output=$(docker load -i ${imageTarPath})`,
      'echo "$output"',
      'id=$(echo "$output" | awk \'{print $NF}\')',
      ...refs.map((ref) => `docker tag "$id" "${ref}"`),
      `echo "Tagged $id as ${refs.join(', ')}"`,
    ].join('\n');

    return dag
      .container()
      .from(DOCKER_CLI_IMAGE)
      .withUnixSocket('/var/run/docker.sock', dockerSocket)
      .withMountedFile(imageTarPath, container.asTarball())
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
    environment: string,
    cloudflareApiToken: Secret,
    cloudflareAccountId: Secret,
    buildEnv?: string[],
    workerVar?: string[],
  ): Promise<string> {
    assertDeployEnvironment(environment);

    const varArgs = workerVarArgs(workspace, workerVar);

    const container = await this.build(workspace, buildEnv);

    const workspaceDir = workspacePath(workspace);

    const deployContainer = withoutProxy(container)
      .withWorkdir(`/app/${workspaceDir}`)
      .withSecretVariable('CLOUDFLARE_API_TOKEN', cloudflareApiToken)
      .withSecretVariable('CLOUDFLARE_ACCOUNT_ID', cloudflareAccountId)
      .withEnvVariable('CLOUDFLARE_ENV', environment)
      .withEnvVariable('DEPLOY_REQUESTED_AT', new Date().toISOString());

    return withBuildEnv(deployContainer, workspace, buildEnv)
      .withExec(['vp', 'run', '--filter', workspace, 'wrangler:deploy', ...varArgs])
      .stdout();
  }

  @func()
  public async migrate(
    workspace: string,
    environment: string,
    dialect: string,
    cloudflareApiToken?: Secret,
    cloudflareAccountId?: Secret,
    postgresUrl?: Secret,
  ): Promise<string> {
    assertDeployEnvironment(environment);

    if (!DATABASE_DIALECTS.has(dialect)) {
      throw new Error(
        `Invalid database dialect '${dialect}' (expected one of: ${[...DATABASE_DIALECTS].join(', ')})`,
      );
    }
    if (
      dialect === 'd1' &&
      (cloudflareApiToken === undefined || cloudflareAccountId === undefined)
    ) {
      throw new Error('cloudflareApiToken and cloudflareAccountId are required for the d1 dialect');
    }
    if (dialect === 'postgres' && postgresUrl === undefined) {
      throw new Error('postgresUrl is required for the postgres dialect');
    }

    const container = await this.vp(workspace);

    let migrateContainer = withoutProxy(container)
      .withEnvVariable('DATABASE_DIALECT', dialect)
      .withEnvVariable('CLOUDFLARE_ENV', environment)
      .withEnvVariable('MIGRATE_REQUESTED_AT', new Date().toISOString());

    if (cloudflareApiToken !== undefined && cloudflareAccountId !== undefined) {
      migrateContainer = migrateContainer
        .withSecretVariable('CLOUDFLARE_API_TOKEN', cloudflareApiToken)
        .withSecretVariable('CLOUDFLARE_ACCOUNT_ID', cloudflareAccountId);
    }
    if (postgresUrl !== undefined) {
      migrateContainer = migrateContainer.withSecretVariable(
        postgresUrlVariable(workspace),
        postgresUrl,
      );
    }

    return migrateContainer.withExec(workspaceImage(workspace).command).stdout();
  }
}
