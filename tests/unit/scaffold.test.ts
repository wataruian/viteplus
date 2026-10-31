import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import {
  addComposeDatabase,
  addEnvExampleKeys,
  allocatePorts,
  assertFreePrefix,
  assertName,
  renameText,
  resetRemoteD1s,
  runCli,
  scaffold,
  stripTemplateOnly,
  toNames,
} from '../../scaffold/scaffold';

const envExample = [
  'ENV="local"',
  '',
  'FRONTEND_PORT="2001"',
  'FRONTEND_INSPECTOR_PORT="8231"',
  'FRONTEND_E2E_PORT="2111"',
  `FRONTEND_URL="http://localhost:\${FRONTEND_PORT}"`,
  `VITE_FRONTEND_URL="\${FRONTEND_URL}"`,
  '',
  'ADMIN_PORT="3001"',
  'ADMIN_INSPECTOR_PORT="9231"',
  'ADMIN_E2E_PORT="3111"',
  `ADMIN_URL="http://localhost:\${ADMIN_PORT}"`,
  `VITE_ADMIN_URL="\${ADMIN_URL}"`,
  '',
  'API_PORT="3000"',
  'API_INSPECTOR_PORT="9230"',
  '',
  'SCHEDULER_PORT="2003"',
  `VITE_SCHEDULER_PORT="\${SCHEDULER_PORT}"`,
  'SCHEDULER_INSPECTOR_PORT="8233"',
  '',
  'POSTGRES_HOST="localhost"',
  'DATASTORE_POSTGRES_DB="lightproject_datastore"',
  `DATASTORE_POSTGRES_URL="postgres://\${POSTGRES_HOST}/\${DATASTORE_POSTGRES_DB}"`,
  'DATABASE_POSTGRES_DB="lightproject"',
  '',
  'JOB_STORE="database"',
  'TASKS_CONCURRENCY="ping=2"',
  'WORKERS_CONCURRENCY=""',
  'SCHEDULER_RUN_TOKEN=""',
  '',
].join('\n');

const frontendPorts = { E2E_PORT: 2111, INSPECTOR_PORT: 8231, PORT: 2001 };

const scratchDirs: string[] = [];

const makeRepo = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-'));
  scratchDirs.push(root);
  const write = (file: string, content: string | Buffer) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };
  write('.env.example', envExample);
  write(
    'docker-compose.yml',
    [
      'services:',
      '  postgres:',
      '    environment:',
      `      DATASTORE_POSTGRES_DB: \${DATASTORE_POSTGRES_DB:-lightproject_datastore}`,
      '',
    ].join('\n'),
  );
  write(
    'templates/frontend/package.json',
    '{ "name": "@lightproject/frontend", "dependencies": { "@lightproject/backend": "workspace:*" } }\n',
  );
  write(
    'templates/frontend/src/config.ts',
    "export const frontendPort = Number(process.env.FRONTEND_PORT ?? '2001'); // backend on 2000\n",
  );
  write('templates/frontend/wrangler.toml', 'name = "lightproject-frontend-dev"\n');
  write(
    'templates/frontend/README.md',
    '# @lightproject/frontend\n\n<!-- template-only -->\nTemplate note.\n<!-- /template-only -->\n\nRun `templates/frontend`.\n',
  );
  write('templates/frontend/public/og-image.png', Buffer.from([0x89, 0x50, 0x00, 0x47]));
  write('templates/frontend/node_modules/x/index.js', 'ignored');
  write('templates/frontend/.env', 'ignored');
  fs.symlinkSync('../../.env.example', path.join(root, 'templates/frontend/linked.env'));
  write('templates/datastore/package.json', '{ "name": "@lightproject/datastore" }\n');
  write(
    'templates/datastore/wrangler.toml',
    [
      'name = "lightproject-datastore"',
      'database_id = "lightproject-datastore-local"',
      '[[env.develop.d1_databases]]',
      'database_name = "lightproject-datastore-dev"',
      'database_id = "00000000-0000-0000-0000-000000000000"',
      '',
    ].join('\n'),
  );
  write(
    'templates/datastore/src/variables.ts',
    "export const db = process.env.DATASTORE_POSTGRES_DB ?? 'lightproject_datastore';\n",
  );
  write(
    'templates/scheduler/vite.config.ts',
    "const port = Number(process.env['SCHEDULER_PORT'] ?? '2003'); // inspector 8233\n",
  );
  write(
    'templates/scheduler/wrangler.toml',
    'name = "lightproject-scheduler"\n[env.develop]\nname = "lightproject-scheduler-dev"\n',
  );
  write(
    'templates/scheduler/src/runtimes/edge.ts',
    'interface EdgeEnv { SCHEDULER_RUN_TOKEN?: string }\n',
  );
  return root;
};

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
  vi.restoreAllMocks();
});

describe('toNames', () => {
  test('derives every naming form from a kebab-case name', () => {
    expect(toNames('admin-portal-2')).toStrictEqual({
      camel: 'adminPortal2',
      kebab: 'admin-portal-2',
      snake: 'admin_portal_2',
      upper: 'ADMIN_PORTAL_2',
    });
  });
});

describe('assertName', () => {
  test.each(['Website', '3site', 'my_site', 'site-', ''])('rejects %j', (name) => {
    expect(() => {
      assertName(name);
    }).toThrow('Invalid name');
  });

  test.each(['frontend', 'common', 'datastore'])('rejects the existing name %j', (name) => {
    expect(() => {
      assertName(name);
    }).toThrow('is an existing workspace or template name');
  });

  test('accepts kebab-case names', () => {
    expect(() => {
      assertName('website');
    }).not.toThrow();
  });
});

describe('allocatePorts', () => {
  test('takes the next free port of each range for a new name', () => {
    expect(allocatePorts(frontendPorts, toNames('website'), envExample)).toStrictEqual(
      new Map([
        [2111, 3112],
        [8231, 9232],
        [2001, 3002],
      ]),
    );
  });

  test('reuses the reserved ports of a name already in .env.example', () => {
    expect(allocatePorts(frontendPorts, toNames('admin'), envExample)).toStrictEqual(
      new Map([
        [2111, 3111],
        [8231, 9231],
        [2001, 3001],
      ]),
    );
  });
});

describe('renameText', () => {
  const from = toNames('frontend');
  const to = toNames('website');
  const ports = new Map([[2001, 3004]]);

  test("renames only the template's own names and ports", () => {
    const text = [
      '@lightproject/frontend @lightproject/frontend-kit @lightproject/backend',
      'templates/frontend templates/frontends templates/backend',
      'lightproject-frontend-dev lightproject-frontends lightproject_frontend',
      'VITE_FRONTEND_URL FRONTEND_PORT BACKEND_URL MYFRONTEND_X',
      'frontendPort backendBaseUrl defaultFrontendPort frontend',
      'localhost:2001 20011 2001.5 2000',
    ].join('\n');

    expect(renameText(text, from, to, ports, 'apps/website')).toBe(
      [
        '@lightproject/website @lightproject/frontend-kit @lightproject/backend',
        'apps/website templates/frontends templates/backend',
        'lightproject-website-dev lightproject-frontends lightproject_website',
        'VITE_WEBSITE_URL WEBSITE_PORT BACKEND_URL MYFRONTEND_X',
        'websitePort backendBaseUrl defaultFrontendPort frontend',
        'localhost:3004 20011 2001.5 2000',
      ].join('\n'),
    );
  });

  test('renames the image references of the template', () => {
    const text = [
      'image: <REGISTRY_ADDRESS>/frontend:<tag>',
      'docker run --rm frontend:latest node dist/index.mjs',
      'docker run --rm --name frontend frontend:latest',
      'the frontend: a template; backend:latest; my-frontend:latest; <REGISTRY_ADDRESS>/backend:<tag>',
    ].join('\n');

    expect(renameText(text, from, to, ports, 'apps/website')).toBe(
      [
        'image: <REGISTRY_ADDRESS>/website:<tag>',
        'docker run --rm website:latest node dist/index.mjs',
        'docker run --rm --name frontend website:latest',
        'the frontend: a template; backend:latest; my-frontend:latest; <REGISTRY_ADDRESS>/backend:<tag>',
      ].join('\n'),
    );
  });

  test('maps dashes to the snake and camel forms', () => {
    expect(
      renameText(
        'lightproject_datastore DATASTORE_DB datastoreUrl',
        toNames('datastore'),
        toNames('my-db'),
        new Map(),
      ),
    ).toBe('lightproject_my_db MY_DB_DB myDbUrl');
  });
});

describe('stripTemplateOnly', () => {
  test('drops the marked blocks with their trailing blank lines', () => {
    expect(
      stripTemplateOnly('a\n\n<!-- template-only -->\nx\n<!-- /template-only -->\n\nb\n'),
    ).toBe('a\n\nb\n');
  });
});

describe('resetRemoteD1s', () => {
  test('blanks the ids and renames the databases only under [env.*]', () => {
    expect(
      resetRemoteD1s(
        'database_id = "local"\n[[env.develop.d1_databases]]\ndatabase_name = "lightproject-datastore-dev"\ndatabase_id = "abc"\n',
        toNames('ledger'),
      ),
    ).toBe(
      'database_id = "local"\n[[env.develop.d1_databases]]\ndatabase_name = "lightproject-ledger-dev"\ndatabase_id = ""\n',
    );
  });

  test('leaves a config without [env.*] untouched', () => {
    expect(resetRemoteD1s('database_id = "local"\n', toNames('ledger'))).toBe(
      'database_id = "local"\n',
    );
  });
});

describe('assertFreePrefix', () => {
  test.each(['postgres', 'vite', 'tasks', 'frontend'])(
    'rejects %j, whose prefix .env.example already uses',
    (name) => {
      expect(() => {
        assertFreePrefix(envExample, toNames(name));
      }).toThrow('.env.example already uses the');
    },
  );

  test.each(['website', 'admin', 'workers'])('accepts %j (new or reserved)', (name) => {
    expect(() => {
      assertFreePrefix(`${envExample}POSTGRES_PORT="5432"\n`, toNames(name));
    }).not.toThrow();
  });

  test('ignores comment lines, even ones that look like a key', () => {
    expect(() => {
      assertFreePrefix(
        '# WEBSITE_URL="http://localhost:3002" goes here\nENV="local"\n',
        toNames('website'),
      );
    }).not.toThrow();
  });
});

describe('addEnvExampleKeys', () => {
  test('adds a renamed paragraph after the template block', () => {
    const ports = allocatePorts(frontendPorts, toNames('website'), envExample);
    const { added, text } = addEnvExampleKeys(
      envExample,
      toNames('frontend'),
      toNames('website'),
      ports,
    );

    expect(added).toStrictEqual([
      'WEBSITE_PORT',
      'WEBSITE_INSPECTOR_PORT',
      'WEBSITE_E2E_PORT',
      'WEBSITE_URL',
      'VITE_WEBSITE_URL',
    ]);
    expect(text).toContain(
      [
        `VITE_FRONTEND_URL="\${FRONTEND_URL}"`,
        '',
        'WEBSITE_PORT="3002"',
        'WEBSITE_INSPECTOR_PORT="9232"',
        'WEBSITE_E2E_PORT="3112"',
        `WEBSITE_URL="http://localhost:\${WEBSITE_PORT}"`,
        `VITE_WEBSITE_URL="\${WEBSITE_URL}"`,
        '',
        'ADMIN_PORT="3001"',
      ].join('\n'),
    );
  });

  test('adds lines inside a paragraph directly after the template lines', () => {
    const { added, text } = addEnvExampleKeys(
      envExample,
      toNames('datastore'),
      toNames('ledger'),
      new Map(),
    );

    expect(added).toStrictEqual(['LEDGER_POSTGRES_DB', 'LEDGER_POSTGRES_URL']);
    expect(text).toContain(
      [
        `DATASTORE_POSTGRES_URL="postgres://\${POSTGRES_HOST}/\${DATASTORE_POSTGRES_DB}"`,
        'LEDGER_POSTGRES_DB="lightproject_ledger"',
        `LEDGER_POSTGRES_URL="postgres://\${POSTGRES_HOST}/\${LEDGER_POSTGRES_DB}"`,
        'DATABASE_POSTGRES_DB="lightproject"',
      ].join('\n'),
    );
  });

  test('adds a paragraph after a template block headed by a comment', () => {
    const { added, text } = addEnvExampleKeys(
      [
        'ENV="local"',
        '',
        '# Tasks app (example: TASKS_PORT="1")',
        'TASKS_PORT="2002"',
        '',
        'X="1"',
      ].join('\n'),
      toNames('tasks'),
      toNames('jobs'),
      new Map([[2002, 3005]]),
    );

    expect(added).toStrictEqual(['JOBS_PORT']);
    expect(text).toBe(
      [
        'ENV="local"',
        '',
        '# Tasks app (example: TASKS_PORT="1")',
        'TASKS_PORT="2002"',
        '',
        'JOBS_PORT="3005"',
        '',
        'X="1"',
      ].join('\n'),
    );
  });

  test('handles a template block at the very start and end of the file', () => {
    expect(
      addEnvExampleKeys('TASKS_CONCURRENCY="ping=2"', toNames('tasks'), toNames('jobs'), new Map())
        .text,
    ).toBe('TASKS_CONCURRENCY="ping=2"\n\nJOBS_CONCURRENCY="ping=2"');
  });

  test('keeps keys that already exist (reserved names)', () => {
    const { added, text } = addEnvExampleKeys(
      envExample,
      toNames('tasks'),
      toNames('workers'),
      new Map(),
    );

    expect(added).toStrictEqual([]);
    expect(text).toBe(envExample);
  });
});

describe('addComposeDatabase', () => {
  const compose =
    '  postgres:\n    environment:\n      DATASTORE_POSTGRES_DB: x\n    volumes: []\n';

  test('adds the database next to the last *_POSTGRES_DB entry', () => {
    expect(addComposeDatabase(compose, toNames('my-db'))).toBe(
      `  postgres:\n    environment:\n      DATASTORE_POSTGRES_DB: x\n      MY_DB_POSTGRES_DB: \${MY_DB_POSTGRES_DB:-lightproject_my_db}\n    volumes: []\n`,
    );
  });

  test('adds a name that is only a suffix of an existing entry', () => {
    expect(addComposeDatabase(compose, toNames('store'))).toContain(
      `      STORE_POSTGRES_DB: \${STORE_POSTGRES_DB:-lightproject_store}`,
    );
  });

  test('leaves an existing entry alone', () => {
    expect(addComposeDatabase(compose, toNames('datastore'))).toBe(compose);
  });

  test('fails without any *_POSTGRES_DB entry', () => {
    expect(() => {
      addComposeDatabase('services: {}\n', toNames('my-db'));
    }).toThrow('docker-compose.yml has no *_POSTGRES_DB entry');
  });
});

describe('scaffold', () => {
  test('copies a frontend as a new app with its own names, ports and env keys', () => {
    const root = makeRepo();
    const output: string[] = [];

    scaffold({
      name: 'website',
      rootDir: root,
      type: 'frontend',
      write: (text) => {
        output.push(text);
      },
    });

    const read = (file: string) => fs.readFileSync(path.join(root, 'apps/website', file), 'utf8');
    expect(JSON.parse(read('package.json'))).toStrictEqual({
      dependencies: { '@lightproject/backend': 'workspace:*' },
      name: '@lightproject/website',
    });
    expect(read('src/config.ts')).toBe(
      "export const websitePort = Number(process.env.WEBSITE_PORT ?? '3002'); // backend on 2000\n",
    );
    expect(read('wrangler.toml')).toBe('name = "lightproject-website-dev"\n');
    expect(read('README.md')).toBe('# @lightproject/website\n\nRun `apps/website`.\n');
    expect([...fs.readFileSync(path.join(root, 'apps/website/public/og-image.png'))]).toStrictEqual(
      [0x89, 0x50, 0x00, 0x47],
    );
    for (const excluded of ['node_modules', '.env', 'linked.env']) {
      expect(fs.existsSync(path.join(root, 'apps/website', excluded))).toBe(false);
    }
    expect(fs.readFileSync(path.join(root, '.env.example'), 'utf8')).toContain(
      'WEBSITE_E2E_PORT="3112"',
    );
    const log = output.join('');
    expect(log).toContain('Scaffolding frontend as apps/website');
    expect(log).toContain('.env.example: added WEBSITE_PORT');
    expect(log).toContain("add '@lightproject/website' to WORKSPACES (path 'apps/website')");
    expect(log).toContain('Workers `lightproject-website-<env>`');
  });

  test('copies a datastore with its own database, compose entry and blank remote D1 ids', () => {
    const root = makeRepo();
    const output: string[] = [];

    scaffold({
      name: 'ledger',
      rootDir: root,
      type: 'datastore',
      write: (text) => {
        output.push(text);
      },
    });

    const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
    expect(read('packages/ledger/wrangler.toml')).toBe(
      [
        'name = "lightproject-ledger"',
        'database_id = "lightproject-ledger-local"',
        '[[env.develop.d1_databases]]',
        'database_name = "lightproject-ledger-dev"',
        'database_id = ""',
        '',
      ].join('\n'),
    );
    expect(read('packages/ledger/src/variables.ts')).toContain(
      "LEDGER_POSTGRES_DB ?? 'lightproject_ledger'",
    );
    expect(read('docker-compose.yml')).toContain(
      `LEDGER_POSTGRES_DB: \${LEDGER_POSTGRES_DB:-lightproject_ledger}`,
    );
    expect(output.join('')).toContain('GitHub secret `LEDGER_POSTGRES_URL`');
  });

  test('copies a scheduler as a new app with its own ports, Workers and run token', () => {
    const root = makeRepo();
    const output: string[] = [];

    scaffold({
      name: 'cron-jobs',
      rootDir: root,
      type: 'scheduler',
      write: (text) => {
        output.push(text);
      },
    });

    const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
    expect(read('apps/cron-jobs/vite.config.ts')).toBe(
      "const port = Number(process.env['CRON_JOBS_PORT'] ?? '3002'); // inspector 9232\n",
    );
    expect(read('apps/cron-jobs/wrangler.toml')).toBe(
      'name = "lightproject-cron-jobs"\n[env.develop]\nname = "lightproject-cron-jobs-dev"\n',
    );
    expect(read('apps/cron-jobs/src/runtimes/edge.ts')).toContain('CRON_JOBS_RUN_TOKEN');
    expect(read('.env.example')).toContain(
      [
        'SCHEDULER_PORT="2003"',
        `VITE_SCHEDULER_PORT="\${SCHEDULER_PORT}"`,
        'SCHEDULER_INSPECTOR_PORT="8233"',
        '',
        'CRON_JOBS_PORT="3002"',
      ].join('\n'),
    );
    expect(read('.env.example')).toContain('SCHEDULER_RUN_TOKEN=""\nCRON_JOBS_RUN_TOKEN=""\n');
    const log = output.join('');
    expect(log).toContain('Scaffolding scheduler as apps/cron-jobs');
    expect(log).toContain('wrangler secret put CRON_JOBS_RUN_TOKEN');
    expect(log).toContain('command `node dist/index.mjs <script> --scheduled`');
  });

  test('reports reserved keys that already exist', () => {
    const root = makeRepo();
    const output: string[] = [];

    scaffold({
      name: 'admin',
      rootDir: root,
      type: 'frontend',
      write: (text) => {
        output.push(text);
      },
    });

    expect(output.join('')).toContain('.env.example: ADMIN_* keys already present');
    expect(fs.readFileSync(path.join(root, 'apps/admin/src/config.ts'), 'utf8')).toContain(
      "?? '3001'",
    );
  });

  test('refuses an existing target and writes to stdout by default', () => {
    const root = makeRepo();
    const stdout = vi.spyOn(globalThis.process.stdout, 'write').mockReturnValue(true);

    scaffold({ name: 'website', rootDir: root, type: 'frontend' });

    expect(stdout).toHaveBeenCalled();
    expect(() => {
      scaffold({ name: 'website', rootDir: root, type: 'frontend' });
    }).toThrow('apps/website already exists');
  });
});

describe('runCli', () => {
  test('takes the name from the command line', () => {
    vi.spyOn(globalThis.process, 'argv', 'get').mockReturnValue(['node', 'index.ts', 'Not Kebab']);

    expect(() => {
      runCli('frontend');
    }).toThrow('Invalid name "Not Kebab"');
  });

  test('fails on a missing name', () => {
    vi.spyOn(globalThis.process, 'argv', 'get').mockReturnValue(['node', 'index.ts']);

    expect(() => {
      runCli('frontend');
    }).toThrow('Invalid name ""');
  });
});
