import { beforeEach, describe, expect, test } from 'vite-plus/test';

import {
  PLAYWRIGHT_BROWSERS_PATH,
  PNPM_STORE_PATH,
  TASK_CACHE_PATH,
  VITE_PLUS_JS_RUNTIME_PATH,
  VITE_PLUS_PACKAGE_MANAGER_PATH,
} from '../../src/helpers/constants';
import {
  installArgs,
  isFrontend,
  outputDirectory,
  shortWorkspaceName,
  withBuildEnv,
  withInstallCaches,
  withPlaywrightChromium,
  withTaskCache,
  workerVarArgs,
  workspace,
  workspacePath,
} from '../../src/helpers/container';
import { FakeContainer, asFakeContainer } from './helpers/dagger-fakes';
import { resetDaggerWorld, world } from './helpers/dagger-world';

beforeEach(() => {
  resetDaggerWorld();
});

describe('workspace', () => {
  test('resolves a known workspace entry', () => {
    expect(workspace('@lightproject/backend')).toStrictEqual({
      isFrontend: false,
      path: 'apps/backend',
    });
  });

  test('throws for an unsupported workspace name', () => {
    expect(() => workspace('@lightproject/does-not-exist')).toThrow(
      'Workspace @lightproject/does-not-exist is not supported',
    );
  });
});

describe('workspacePath', () => {
  test('returns the workspace directory', () => {
    expect(workspacePath('@lightproject/frontend')).toBe('apps/frontend');
    expect(workspacePath('@lightproject/common')).toBe('packages/common');
  });
});

describe('shortWorkspaceName', () => {
  test('returns the last path segment', () => {
    expect(shortWorkspaceName('apps/frontend')).toBe('frontend');
    expect(shortWorkspaceName('packages/design-system')).toBe('design-system');
  });
});

describe('isFrontend', () => {
  test('is true for frontend-flagged workspaces', () => {
    expect(isFrontend('@lightproject/frontend')).toBe(true);
    expect(isFrontend('@lightproject/design-system')).toBe(true);
  });

  test('is false for non-frontend workspaces', () => {
    expect(isFrontend('@lightproject/backend')).toBe(false);
    expect(isFrontend('@lightproject/library')).toBe(false);
  });
});

describe('installArgs', () => {
  test('defaults to a dev install', () => {
    expect(installArgs()).toStrictEqual(['vp', 'install', '--frozen-lockfile']);
  });

  test('adds --prod for a prod install', () => {
    expect(installArgs('prod')).toStrictEqual(['vp', 'install', '--prod', '--frozen-lockfile']);
  });
});

describe('outputDirectory', () => {
  test('wraps the content in a new file named after the task', async () => {
    const directory = outputDirectory('madge', 'some output');
    await expect(directory.file('madge.output').contents()).resolves.toBe('some output');
  });
});

describe('withInstallCaches', () => {
  test('mounts the package manager, JS runtime, and pnpm store caches', () => {
    const container = withInstallCaches(new FakeContainer(world));
    expect(asFakeContainer(container).capturedCachePaths).toStrictEqual([
      VITE_PLUS_PACKAGE_MANAGER_PATH,
      VITE_PLUS_JS_RUNTIME_PATH,
      PNPM_STORE_PATH,
    ]);
  });
});

describe('withTaskCache', () => {
  test('mounts the task cache at the shared path', () => {
    const container = withTaskCache(new FakeContainer(world), 'root');
    expect(asFakeContainer(container).capturedCachePaths).toStrictEqual([TASK_CACHE_PATH]);
  });
});

describe('withBuildEnv', () => {
  test('is a no-op when there is no buildEnv', () => {
    const container = withBuildEnv(new FakeContainer(world), '@lightproject/backend');
    expect(asFakeContainer(container).capturedEnvVariables.size).toBe(0);
  });

  test('applies each KEY=VALUE entry for a frontend workspace', () => {
    const container = withBuildEnv(new FakeContainer(world), '@lightproject/frontend', [
      'VITE_ENV=production',
      'VITE_BACKEND_URL=https://backend.example.com',
    ]);
    expect(asFakeContainer(container).capturedEnvVariables).toStrictEqual(
      new Map([
        ['VITE_ENV', 'production'],
        ['VITE_BACKEND_URL', 'https://backend.example.com'],
      ]),
    );
  });

  test('splits only on the first "=" so values may contain it', () => {
    const container = withBuildEnv(new FakeContainer(world), '@lightproject/frontend', [
      'VITE_BACKEND_URL=https://backend.example.com?x=1',
    ]);
    expect(asFakeContainer(container).capturedEnvVariables.get('VITE_BACKEND_URL')).toBe(
      'https://backend.example.com?x=1',
    );
  });

  test('throws for a non-frontend workspace', () => {
    expect(() =>
      withBuildEnv(new FakeContainer(world), '@lightproject/backend', ['VITE_ENV=production']),
    ).toThrow("buildEnv is only supported for frontend workspaces, got '@lightproject/backend'");
  });

  test('throws for an entry missing "="', () => {
    expect(() =>
      withBuildEnv(new FakeContainer(world), '@lightproject/frontend', ['NOVALUE']),
    ).toThrow('Invalid build env entry (expected KEY=VALUE): NOVALUE');
  });
});

describe('workerVarArgs', () => {
  test.each([undefined, []])('is empty when there are no worker vars (%j)', (workerVars) => {
    expect(workerVarArgs('@lightproject/backend', workerVars)).toStrictEqual([]);
  });

  test('turns each KEY=VALUE entry into a wrangler --var KEY:VALUE pair', () => {
    expect(
      workerVarArgs('@lightproject/backend', [
        'OTLP_ENDPOINT=https://otel.example.com',
        'LOG_LEVEL=debug',
      ]),
    ).toStrictEqual([
      '--var',
      'OTLP_ENDPOINT:https://otel.example.com',
      '--var',
      'LOG_LEVEL:debug',
    ]);
  });

  test('splits only on the first "=" so values may contain it', () => {
    expect(workerVarArgs('@lightproject/backend', ['URL=https://x.example.com?a=1'])).toStrictEqual(
      ['--var', 'URL:https://x.example.com?a=1'],
    );
  });

  test.each(['@lightproject/frontend', '@lightproject/design-system'])(
    'throws for the frontend workspace %s',
    (workspaceName) => {
      expect(() => workerVarArgs(workspaceName, ['LOG_LEVEL=debug'])).toThrow(
        `workerVar is only supported for backend workspaces, got '${workspaceName}'`,
      );
    },
  );

  test('throws for an entry missing "="', () => {
    expect(() => workerVarArgs('@lightproject/backend', ['LOG_LEVEL'])).toThrow(
      'Invalid worker var entry (expected KEY=VALUE): LOG_LEVEL',
    );
  });

  test.each(['', 'log_level', '1LEVEL', 'LOG-LEVEL', 'LOG LEVEL', '--dry-run'])(
    'rejects the name %j',
    (key) => {
      expect(() => workerVarArgs('@lightproject/backend', [`${key}=x`])).toThrow(
        `Invalid worker var name '${key}'`,
      );
    },
  );

  test.each(['', 'two words', 'line\nbreak', ' leading'])('rejects the value %j', (value) => {
    expect(() => workerVarArgs('@lightproject/backend', [`LOG_LEVEL=${value}`])).toThrow(
      "Invalid worker var value for 'LOG_LEVEL'",
    );
  });
});

describe('withPlaywrightChromium', () => {
  test('installs system deps as root, then the browser as vp into a cached path', () => {
    const container = asFakeContainer(
      withPlaywrightChromium(new FakeContainer(world), '@lightproject/frontend'),
    );

    expect(container.capturedUsers).toStrictEqual(['root', 'vp']);
    expect(container.capturedNewFiles.get('/etc/apt/apt.conf.d/99-no-proxy')).toBe(
      'Acquire::http::Proxy "false";\nAcquire::https::Proxy "false";\n',
    );
    expect(container.capturedExecCalls).toStrictEqual([
      [
        'sed',
        '-i',
        's|http://deb.debian.org|https://deb.debian.org|g',
        '/etc/apt/sources.list.d/debian.sources',
      ],
      [
        'vp',
        'exec',
        '--filter',
        '@lightproject/frontend',
        'playwright',
        'install-deps',
        'chromium',
      ],
      ['vp', 'exec', '--filter', '@lightproject/frontend', 'playwright', 'install', 'chromium'],
    ]);
    expect(container.capturedCachePaths).toStrictEqual([PLAYWRIGHT_BROWSERS_PATH]);
    expect(container.capturedEnvVariables.get('PLAYWRIGHT_BROWSERS_PATH')).toBe(
      PLAYWRIGHT_BROWSERS_PATH,
    );
  });
});
