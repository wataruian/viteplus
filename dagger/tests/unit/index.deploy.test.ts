import { Secret, Socket } from '@dagger.io/dagger';
import { beforeEach, describe, expect, test } from 'vite-plus/test';

import { VITE_PLUS_JS_RUNTIME_PATH } from '../../src/helpers/constants';
import { asFakeContainer, getLastContainer, resetLastContainer } from './helpers/dagger-fakes';
import { resetDaggerWorld, world } from './helpers/dagger-world';
import { seedMountFiles } from './helpers/fixtures';
import { createMonorepo } from './helpers/monorepo';

beforeEach(() => {
  resetDaggerWorld();
  resetLastContainer();
});

const fakeSocket = new Socket();
const fakeSecret = new Secret();

describe('nginx', () => {
  test('mounts the vite build from "out" and the storybook static site when both are present', async () => {
    seedMountFiles();
    world.dirs.set('/app/apps/frontend', ['out/', 'storybook-static/']);

    const container = await createMonorepo().nginx('@lightproject/frontend');

    expect(asFakeContainer(container).capturedDefaultArgs).toStrictEqual([
      'nginx',
      '-g',
      'daemon off;',
    ]);
  });

  test('falls back to "dist" when "out" is absent and skips storybook when absent', async () => {
    seedMountFiles();
    world.dirs.set('/app/apps/frontend', ['dist/']);

    const container = await createMonorepo().nginx('@lightproject/frontend');

    expect(asFakeContainer(container).capturedDefaultArgs).toStrictEqual([
      'nginx',
      '-g',
      'daemon off;',
    ]);
  });

  test('mounts neither vite artifact directory when neither is present', async () => {
    seedMountFiles();
    world.dirs.set('/app/apps/frontend', []);

    const container = await createMonorepo().nginx('@lightproject/frontend');

    expect(asFakeContainer(container).capturedDirectoryPaths).not.toContain(
      '/usr/share/nginx/html/vite',
    );
  });
});

describe('vp', () => {
  test('copies dist artifacts for packages that have them, across apps and packages', async () => {
    seedMountFiles();
    world.dirs.set('/app', ['apps/', 'packages/']);
    world.dirs.set('/app/apps', ['frontend/']);
    world.dirs.set('/app/packages', ['common/']);
    world.dirs.set('/app/apps/frontend', ['dist/']);
    world.dirs.set('/app/packages/common', []);

    const container = await createMonorepo().vp('@lightproject/backend');
    const fake = asFakeContainer(container);

    expect(fake.capturedDirectoryPaths).toContain('/app/apps/frontend/dist');
    expect(fake.capturedDirectoryPaths).not.toContain('/app/packages/common/dist');
    expect(fake.capturedWorkdir).toBe('/app/apps/backend');
    expect(fake.capturedDefaultArgs).toStrictEqual(['node', 'dist/index.mjs']);
    expect(fake.capturedFilePaths).toStrictEqual([]);
  });

  test('bakes the JS runtime into the image instead of leaving it on the cache volume', async () => {
    seedMountFiles();
    world.dirs.set('/app', []);

    const fake = asFakeContainer(await createMonorepo().vp('@lightproject/backend'));

    expect(fake.capturedRemovedMounts).toStrictEqual([VITE_PLUS_JS_RUNTIME_PATH]);
    expect(fake.capturedExecCalls.at(-1)).toStrictEqual(['node', '--version']);
  });

  test("adds the workspace's image files and command (database: the migrator)", async () => {
    seedMountFiles();
    world.dirs.set('/app', []);
    world.dirs.set('packages/database', [
      'drizzle.postgres.config.ts',
      'migrations/',
      'src/',
      'wrangler.toml',
    ]);

    const fake = asFakeContainer(await createMonorepo().vp('@lightproject/database'));

    expect(fake.capturedDirectoryPaths).toContain('/app/packages/database/migrations');
    expect(fake.capturedDirectoryPaths).not.toContain('/app/packages/database/src');
    expect(fake.capturedFilePaths).toStrictEqual(['/app/packages/database/wrangler.toml']);
    expect(fake.capturedWorkdir).toBe('/app/packages/database');
    expect(fake.capturedDefaultArgs).toStrictEqual(['node', 'dist/scripts/migrate.mjs']);
  });

  test('copies nothing when the root has neither apps nor packages', async () => {
    seedMountFiles();
    world.dirs.set('/app', []);

    const container = await createMonorepo().vp('@lightproject/backend');

    expect(asFakeContainer(container).capturedDirectoryPaths).toStrictEqual(['/app']);
  });
});

describe('load', () => {
  test('loads and tags a frontend (nginx) image, adding the extra tag when given', async () => {
    seedMountFiles();
    world.dirs.set('/app/apps/frontend', []);
    world.execStdout = 'Loaded image: frontend:latest';

    const stdout = await createMonorepo().load('@lightproject/frontend', fakeSocket, 'v1.2.3');

    expect(stdout).toBe('Loaded image: frontend:latest');
  });

  test('loads and tags a non-frontend (vp) image without an extra tag when omitted', async () => {
    seedMountFiles();
    world.dirs.set('/app', []);
    world.execStdout = 'Loaded image: backend:latest';

    const stdout = await createMonorepo().load('@lightproject/backend', fakeSocket);

    expect(stdout).toBe('Loaded image: backend:latest');
  });

  test('does not add an extra tag when it is an empty string', async () => {
    seedMountFiles();
    world.dirs.set('/app', []);
    world.execStdout = 'Loaded image: backend:latest';

    const stdout = await createMonorepo().load('@lightproject/backend', fakeSocket, '');

    expect(stdout).toBe('Loaded image: backend:latest');
  });
});

describe('publish', () => {
  test('publishes a frontend (nginx) image with the extra tag when given', async () => {
    seedMountFiles();
    world.dirs.set('/app/apps/frontend', []);

    const message = await createMonorepo().publish(
      '@lightproject/frontend',
      'registry.example.com/frontend',
      'v1.2.3',
    );

    expect(message).toBe(
      'Published registry.example.com/frontend:latest@sha256:fakedigest, registry.example.com/frontend:v1.2.3@sha256:fakedigest',
    );
  });

  test('publishes a non-frontend (vp) image without an extra tag when omitted', async () => {
    seedMountFiles();
    world.dirs.set('/app', []);

    const message = await createMonorepo().publish(
      '@lightproject/backend',
      'registry.example.com/backend',
    );

    expect(message).toBe('Published registry.example.com/backend:latest@sha256:fakedigest');
  });

  test('does not add an extra tag when it is an empty string', async () => {
    seedMountFiles();
    world.dirs.set('/app', []);

    const message = await createMonorepo().publish(
      '@lightproject/backend',
      'registry.example.com/backend',
      '',
    );

    expect(message).toBe('Published registry.example.com/backend:latest@sha256:fakedigest');
  });
});

describe('wrangler', () => {
  test('deploys the built workspace to the target environment’s Worker via CLOUDFLARE_ENV', async () => {
    seedMountFiles();
    world.execStdout = 'Deployed to Cloudflare';

    const stdout = await createMonorepo().wrangler(
      '@lightproject/backend',
      'staging',
      fakeSecret,
      fakeSecret,
    );

    expect(stdout).toBe('Deployed to Cloudflare');
    const container = getLastContainer();
    expect(container.capturedEnvVariables.get('CLOUDFLARE_ENV')).toBe('staging');
    expect(container.capturedEnvVariables.get('DEPLOY_REQUESTED_AT')).toMatch(
      /^\d{4}-\d{2}-\d{2}T/u,
    );
    expect(container.capturedExecCalls).toContainEqual([
      'vp',
      'run',
      '--filter',
      '@lightproject/backend',
      'wrangler:deploy',
    ]);
  });

  test('appends each worker var to wrangler deploy as --var KEY:VALUE', async () => {
    seedMountFiles();
    world.execStdout = 'Deployed to Cloudflare';

    await createMonorepo().wrangler(
      '@lightproject/backend',
      'develop',
      fakeSecret,
      fakeSecret,
      undefined,
      ['OTLP_ENDPOINT=https://otel.example.com'],
    );

    expect(getLastContainer().capturedExecCalls).toContainEqual([
      'vp',
      'run',
      '--filter',
      '@lightproject/backend',
      'wrangler:deploy',
      '--var',
      'OTLP_ENDPOINT:https://otel.example.com',
    ]);
  });

  test('rejects worker vars for a frontend workspace before building', async () => {
    await expect(
      createMonorepo().wrangler(
        '@lightproject/frontend',
        'develop',
        fakeSecret,
        fakeSecret,
        undefined,
        ['OTLP_ENDPOINT=https://otel.example.com'],
      ),
    ).rejects.toThrow(
      "workerVar is only supported for backend workspaces, got '@lightproject/frontend'",
    );
    expect(() => getLastContainer()).toThrow('no fake container has been created yet');
  });

  test.each(['', 'pr', 'dev', 'Production', 'develop;rm -rf /'])(
    'rejects %j before building',
    async (environment) => {
      await expect(
        createMonorepo().wrangler('@lightproject/backend', environment, fakeSecret, fakeSecret),
      ).rejects.toThrow(`Invalid environment '${environment}'`);
    },
  );
});

const seedDatabaseImage = (): void => {
  seedMountFiles();
  world.dirs.set('/app', []);
  world.dirs.set('packages/database', ['migrations/', 'src/']);
};

describe('migrate', () => {
  test.each(['d1', 'postgres'])(
    'runs the %s migrator image for the target environment',
    async (dialect) => {
      seedDatabaseImage();
      world.execStdout = 'migrated';

      const stdout = await createMonorepo().migrate(
        '@lightproject/database',
        'production',
        dialect,
        fakeSecret,
        fakeSecret,
        fakeSecret,
      );

      expect(stdout).toBe('migrated');
      const container = getLastContainer();
      expect(container.capturedWorkdir).toBe('/app/packages/database');
      expect(container.capturedEnvVariables.get('DATABASE_DIALECT')).toBe(dialect);
      expect(container.capturedEnvVariables.get('CLOUDFLARE_ENV')).toBe('production');
      expect(container.capturedEnvVariables.get('HTTPS_PROXY')).toBe('');
      expect(container.capturedEnvVariables.get('MIGRATE_REQUESTED_AT')).toMatch(
        /^\d{4}-\d{2}-\d{2}T/u,
      );
      expect(container.capturedExecCalls.at(-1)).toStrictEqual([
        'node',
        'dist/scripts/migrate.mjs',
      ]);
    },
  );

  test.each([
    ['d1', [fakeSecret, fakeSecret, undefined]],
    ['postgres', [undefined, undefined, fakeSecret]],
  ] as const)('runs %s with only its own credentials', async (dialect, secrets) => {
    seedDatabaseImage();

    await createMonorepo().migrate('@lightproject/database', 'develop', dialect, ...secrets);

    expect(getLastContainer().capturedExecCalls.at(-1)).toStrictEqual([
      'node',
      'dist/scripts/migrate.mjs',
    ]);
  });

  test.each([
    [
      'd1',
      [undefined, undefined, fakeSecret],
      'cloudflareApiToken and cloudflareAccountId are required',
    ],
    ['postgres', [fakeSecret, fakeSecret, undefined], 'postgresUrl is required'],
    ['sqlite', [fakeSecret, fakeSecret, fakeSecret], "Invalid database dialect 'sqlite'"],
  ] as const)(
    'rejects dialect %s with missing inputs before mounting',
    async (dialect, secrets, message) => {
      await expect(
        createMonorepo().migrate('@lightproject/database', 'develop', dialect, ...secrets),
      ).rejects.toThrow(message);
      expect(() => getLastContainer()).toThrow('no fake container has been created yet');
    },
  );

  test.each(['', 'pr', 'local', 'develop;rm -rf /'])(
    'rejects environment %j before mounting',
    async (environment) => {
      await expect(
        createMonorepo().migrate(
          '@lightproject/database',
          environment,
          'd1',
          fakeSecret,
          fakeSecret,
        ),
      ).rejects.toThrow(`Invalid environment '${environment}'`);
      expect(() => getLastContainer()).toThrow('no fake container has been created yet');
    },
  );
});
