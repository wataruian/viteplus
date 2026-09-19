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

const SEMGREP_RULESETS: string[] = [
  '--config=p/security-audit',
  '--config=p/owasp-top-ten',
  '--config=p/javascript',
  '--config=p/typescript',
  '--config=p/react',
];

const SEMGREP_EXCLUSIONS: string[] = [
  '--exclude-rule=yaml.github-actions.security.github-actions-mutable-action-tag.github-actions-mutable-action-tag',
  '--exclude-rule=package_managers.renovate.renovate-missing-minimum-release-age.renovate-missing-minimum-release-age',
  '--exclude-rule=yaml.docker-compose.security.privileged-service.privileged-service',
  '--exclude-rule=package_managers.pnpm.pnpm-trust-policy.pnpm-trust-policy',
  '--exclude-rule=package_managers.pnpm.pnpm-missing-minimum-release-age.pnpm-minimum-release-age',
  '--exclude-rule=package_managers.pnpm.pnpm-block-exotic-sub-dependencies.pnpm-block-exotic-sub-dependencies',
  '--exclude-rule=package_managers.npm.npm-missing-minimum-release-age.npm-missing-minimum-release-age',
  '--exclude-rule=generic.html-templates.security.unquoted-attribute-var.unquoted-attribute-var',
];

const SOURCE_IGNORE: string[] = [
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

const ROOT_FILES: string[] = [
  'root.txt',
  'tsconfig.base.json',
  'tsconfig.json',
  'tsconfig.madge.json',
  'vite.config.ts',
];

const MANIFEST_FILES: string[] = [
  'package.json',
  '**/package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  '.gitignore',
  ...ROOT_FILES,
];

const DAGGER_WORKSPACE = 'dagger';

const WORKSPACES: Record<string, { isFrontend: boolean; path: string } | undefined> = {
  '@lightproject/backend': { isFrontend: false, path: 'apps/backend' },
  '@lightproject/common': { isFrontend: false, path: 'packages/common' },
  '@lightproject/design-system': { isFrontend: true, path: 'packages/design-system' },
  '@lightproject/frontend': { isFrontend: true, path: 'apps/frontend' },
  '@lightproject/library': { isFrontend: false, path: 'packages/library' },
};

const WORKSPACE_NAMES = Object.keys(WORKSPACES);

const BUILD_ARTIFACT_KEEP: string[] = [
  'dist',
  'out',
  'storybook-static',
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
];

export {
  BUILD_ARTIFACT_KEEP,
  CURL_IMAGE,
  DAGGER_WORKSPACE,
  DOCKER_CLI_VERSION,
  MANIFEST_FILES,
  NGINX_IMAGE,
  PNPM_STORE_PATH,
  ROOT_FILES,
  SEMGREP_EXCLUSIONS,
  SEMGREP_IMAGE,
  SEMGREP_RULESETS,
  SONAR_LOCAL_DOCKER_NETWORK,
  SONAR_LOCAL_HOST_URL,
  SONAR_SCANNER_IMAGE,
  SONAR_SCANNER_USER,
  SONAR_WORKING_DIRECTORY,
  SOURCE_IGNORE,
  TASK_CACHE_PATH,
  VITE_PLUS_IMAGE,
  VITE_PLUS_JS_RUNTIME_PATH,
  VITE_PLUS_PACKAGE_MANAGER_PATH,
  VITE_PLUS_USER,
  WORKSPACE_NAMES,
  WORKSPACES,
};
