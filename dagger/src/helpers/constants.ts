const VITE_PLUS_IMAGE = 'ghcr.io/voidzero-dev/vite-plus:1.4.0';
const VITE_PLUS_USER = 'vp';
const VITE_PLUS_PACKAGE_MANAGER_PATH = '/home/vp/.vite-plus/package_manager';
const VITE_PLUS_JS_RUNTIME_PATH = '/home/vp/.vite-plus/js_runtime';
const PLAYWRIGHT_BROWSERS_PATH = '/home/vp/.cache/ms-playwright';
const PNPM_STORE_PATH = '/home/vp/.local/share/pnpm/store';
const TASK_CACHE_PATH = '/app/node_modules/.vite/task-cache';

const NGINX_IMAGE = 'nginx:1.27.0-alpine';
const DOCKER_CLI_IMAGE = 'docker:27.5.1-cli';
const SEMGREP_IMAGE = 'semgrep/semgrep:1.177.0';
const SONAR_SCANNER_IMAGE = 'sonarsource/sonar-scanner-cli:12.1.0.3233_8.0.1';
const SONAR_SCANNER_USER = 'scanner-cli';
const SONAR_WORKING_DIRECTORY = '/usr/src/.scannerwork';
const CURL_IMAGE = 'curlimages/curl:8.14.1';
const POSTGRES_IMAGE = 'postgres:17.6-alpine';

const POSTGRES_SERVICE_HOST = 'postgres';
const POSTGRES_SERVICE_PORT = 5432;
const POSTGRES_SERVICE_CREDENTIAL = 'lightproject'; // NOSONAR

const SONAR_LOCAL_HOST_URL = 'http://sonarqube:9000'; // NOSONAR

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
  'dagger',
  '.git',
  '.github',
  '.mise',
  '.outputs',
  '**/.pruned',
  '**/.vite-hooks',
  '.vscode',
  '**/bak',
  'configs',
  '**/tmp',
  '**/e2e-test-results',
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

const WORKSPACE_GROUPS: readonly string[] = ['apps', 'packages', 'templates'];

const DEPLOY_ENVIRONMENTS: ReadonlySet<string> = new Set(['develop', 'staging', 'production']);

const DATABASE_DIALECTS: ReadonlySet<string> = new Set(['d1', 'postgres']);

interface WorkspaceImage {
  command: string[];
  files: string[];
}

interface WorkspaceEntry {
  image?: WorkspaceImage;
  isFrontend: boolean;
  path: string;
}

const DEFAULT_WORKSPACE_IMAGE: WorkspaceImage = { command: ['node', 'dist/index.mjs'], files: [] };

const WORKSPACES: Record<string, WorkspaceEntry | undefined> = {
  '@lightproject/backend': { isFrontend: false, path: 'templates/backend' },
  '@lightproject/common': { isFrontend: false, path: 'packages/common' },
  '@lightproject/datastore': {
    image: {
      command: ['node', 'dist/scripts/migrate.mjs'],
      files: ['migrations', 'wrangler.toml'],
    },
    isFrontend: false,
    path: 'templates/datastore',
  },
  '@lightproject/design-system': { isFrontend: true, path: 'packages/design-system' },
  '@lightproject/frontend': { isFrontend: true, path: 'templates/frontend' },
  '@lightproject/library': { isFrontend: false, path: 'templates/library' },
  '@lightproject/scheduler': { isFrontend: false, path: 'templates/scheduler' },
  '@lightproject/tasks': { isFrontend: false, path: 'templates/tasks' },
};

const WORKSPACE_NAMES = Object.keys(WORKSPACES);

const BUILD_ARTIFACT_KEEP: string[] = [
  'dist',
  'out',
  'storybook-static',
  'package.json',
  'tsconfig.json',
  'tsconfig.pack.json',
  'vite.config.ts',
];

export {
  BUILD_ARTIFACT_KEEP,
  CURL_IMAGE,
  DAGGER_WORKSPACE,
  DATABASE_DIALECTS,
  DEFAULT_WORKSPACE_IMAGE,
  DEPLOY_ENVIRONMENTS,
  DOCKER_CLI_IMAGE,
  MANIFEST_FILES,
  NGINX_IMAGE,
  PLAYWRIGHT_BROWSERS_PATH,
  PNPM_STORE_PATH,
  POSTGRES_IMAGE,
  POSTGRES_SERVICE_CREDENTIAL,
  POSTGRES_SERVICE_HOST,
  POSTGRES_SERVICE_PORT,
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
  WORKSPACE_GROUPS,
  WORKSPACE_NAMES,
  WORKSPACES,
};
export type { WorkspaceEntry, WorkspaceImage };
