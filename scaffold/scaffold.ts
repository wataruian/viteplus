/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';

type TemplateType = 'backend' | 'datastore' | 'frontend' | 'library' | 'tasks';

interface TemplateSpec {
  checklist: string[];
  group: 'apps' | 'packages';
  ports: Record<string, number>;
}

interface Names {
  camel: string;
  kebab: string;
  snake: string;
  upper: string;
}

interface ScaffoldOptions {
  name: string;
  rootDir: string;
  type: TemplateType;
  write?: (text: string) => void;
}

const portRangeStart: Record<string, number> = {
  E2E_PORT: 3111,
  INSPECTOR_PORT: 9230,
  PORT: 3000,
};

const deployChecklist = [
  '.github/workflows/deploy.yml: add it to `all-workspaces` and add its job (mind the deploy order)',
  '.github/workflows/trigger.yml: add it to the `workspace` options',
  '.github/workflows/deploy-workspace.yml: extend the conditions that name the template, if any apply',
];

const templates: Record<TemplateType, TemplateSpec> = {
  backend: {
    checklist: [
      ...deployChecklist,
      'Its Workers `lightproject-<name>-<env>` are created by the first deploy',
    ],
    group: 'apps',
    ports: { INSPECTOR_PORT: 8230, PORT: 2000 },
  },
  datastore: {
    checklist: [
      ...deployChecklist,
      'dagger/src/helpers/constants.ts: give it the migrator `image` like `@lightproject/datastore`',
      'Create its remote D1s (`vp exec wrangler d1 create lightproject-<name>-<env>`) and put the ids in `wrangler.toml` [env.*]',
      'Existing local Postgres volume: `docker compose up -d postgres && docker compose exec postgres sh /docker-entrypoint-initdb.d/create-databases.sh`',
      'GitHub secret `<NAME>_POSTGRES_URL` for the `postgres` dialect',
    ],
    group: 'packages',
    ports: {},
  },
  frontend: {
    checklist: [
      ...deployChecklist,
      'Its Workers `lightproject-<name>-<env>` are created by the first deploy',
    ],
    group: 'apps',
    ports: { E2E_PORT: 2111, INSPECTOR_PORT: 8231, PORT: 2001 },
  },
  library: { checklist: [], group: 'packages', ports: {} },
  tasks: {
    checklist: [
      ...deployChecklist,
      'Its Workers `lightproject-<name>-<env>` are created by the first deploy',
    ],
    group: 'apps',
    ports: { INSPECTOR_PORT: 8232, PORT: 2002 },
  },
};

const excludedNames: ReadonlySet<string> = new Set([
  '.env',
  '.git',
  '.pruned',
  '.wrangler',
  'coverage',
  'dist',
  'e2e-test-results',
  'node_modules',
  'out',
  'storybook-static',
  'tmp',
  'tsconfig.tsbuildinfo',
]);

const reservedNames: ReadonlySet<string> = new Set([
  'backend',
  'common',
  'dagger',
  'datastore',
  'design-system',
  'frontend',
  'library',
  'tasks',
]);

const toNames = (kebab: string): Names => ({
  camel: kebab.replaceAll(/-(?<letter>[a-z0-9])/gu, (_match, letter: string) =>
    letter.toUpperCase(),
  ),
  kebab,
  snake: kebab.replaceAll('-', '_'),
  upper: kebab.replaceAll('-', '_').toUpperCase(),
});

const assertName = (name: string) => {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(name)) {
    throw new Error(`Invalid name "${name}": use kebab-case, e.g. website3 or admin-portal`);
  }
  if (reservedNames.has(name)) {
    throw new Error(`"${name}" is an existing workspace or template name`);
  }
};

const keyOf = (line: string) => line.slice(0, line.indexOf('='));

const escapeRegExp = (text: string) => text.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`);

const usedPorts = (envExample: string): Set<number> =>
  new Set(
    [...envExample.matchAll(/^(?!VITE_)[A-Z0-9_]+_PORT="(?<port>\d+)"$/gmu)].map((match) =>
      Number(match.groups?.['port']),
    ),
  );

const allocatePorts = (
  ports: Record<string, number>,
  names: Names,
  envExample: string,
): Map<number, number> => {
  const used = usedPorts(envExample);
  const allocated = new Map<number, number>();
  for (const [suffix, templatePort] of Object.entries(ports)) {
    const reserved = new RegExp(`^${names.upper}_${suffix}="(?<port>\\d+)"$`, 'mu').exec(
      envExample,
    );
    let port = Number(reserved?.groups?.['port'] ?? portRangeStart[suffix]);
    if (!reserved) {
      while (used.has(port)) {
        port += 1;
      }
    }
    used.add(port);
    allocated.set(templatePort, port);
  }
  return allocated;
};

const renameText = (
  text: string,
  from: Names,
  to: Names,
  ports: ReadonlyMap<number, number>,
  targetDir = '',
): string => {
  const kebab = escapeRegExp(from.kebab);
  let result = text
    .replaceAll(
      new RegExp(`@lightproject/${kebab}(?![a-z0-9-])`, 'gu'),
      `@lightproject/${to.kebab}`,
    )
    .replaceAll(new RegExp(`\\btemplates/${kebab}(?![a-z0-9-])`, 'gu'), targetDir)
    .replaceAll(new RegExp(`lightproject-${kebab}(?![a-z0-9])`, 'gu'), `lightproject-${to.kebab}`)
    .replaceAll(
      new RegExp(`lightproject_${from.snake}(?![a-z0-9])`, 'gu'),
      `lightproject_${to.snake}`,
    )
    .replaceAll(new RegExp(`(?<![A-Z0-9])${from.upper}_`, 'gu'), `${to.upper}_`)
    .replaceAll(new RegExp(`(?<![A-Za-z0-9])${from.camel}(?=[A-Z])`, 'gu'), to.camel);
  for (const [templatePort, port] of ports) {
    result = result.replaceAll(
      new RegExp(`(?<![0-9.])${templatePort}(?![0-9]|\\.[0-9])`, 'gu'),
      `${port}`,
    );
  }
  return result;
};

const stripTemplateOnly = (markdown: string): string =>
  markdown.replaceAll(/<!-- template-only -->[\s\S]*?<!-- \/template-only -->\n*/gu, '');

const resetRemoteD1s = (wranglerToml: string, to: Names): string => {
  const envStart = wranglerToml.indexOf('[[env.');
  if (envStart === -1) {
    return wranglerToml;
  }
  return (
    wranglerToml.slice(0, envStart) +
    wranglerToml
      .slice(envStart)
      .replaceAll(/^database_id = ".*"$/gmu, 'database_id = ""')
      .replaceAll(
        /^database_name = ".*-(?<suffix>[a-z]+)"$/gmu,
        `database_name = "lightproject-${to.kebab}-$<suffix>"`,
      )
  );
};

const reservedAppNames: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'database',
  'site',
  'workers',
]);

const assertFreePrefix = (envExample: string, names: Names) => {
  if (reservedAppNames.has(names.kebab)) {
    return;
  }
  const taken = envExample
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => keyOf(line))
    .filter((key) => key.startsWith(`${names.upper}_`) || key.startsWith(`VITE_${names.upper}_`));
  if (taken.length > 0) {
    throw new Error(
      `.env.example already uses the ${names.upper}_ prefix (${taken.join(', ')}); pick another name`,
    );
  }
};

const addEnvExampleKeys = (
  envExample: string,
  from: Names,
  to: Names,
  ports: ReadonlyMap<number, number>,
): { added: string[]; text: string } => {
  const lines = envExample.split('\n');
  const isTemplateLine = (line: string) =>
    new RegExp(`^(?:VITE_)?${from.upper}_[A-Z0-9_]*=`, 'u').test(line);
  const existing = new Set(lines.filter((line) => line.includes('=')).map((line) => keyOf(line)));
  const added: string[] = [];
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    output.push(lines[index]);
    if (isTemplateLine(lines[index]) && !isTemplateLine(lines[index + 1] ?? '')) {
      let start = index;
      while (start > 0 && isTemplateLine(lines[start - 1])) {
        start -= 1;
      }
      const block = lines
        .slice(start, index + 1)
        .map((line) => renameText(line, from, to, ports))
        .filter((line) => !existing.has(keyOf(line)));
      if (block.length > 0) {
        const isParagraph = (lines[start - 1] ?? '') === '' && (lines[index + 1] ?? '') === '';
        output.push(...(isParagraph ? ['', ...block] : block));
        added.push(...block.map((line) => keyOf(line)));
      }
    }
  }
  return { added, text: output.join('\n') };
};

const addComposeDatabase = (compose: string, to: Names): string => {
  const key = `${to.upper}_POSTGRES_DB`;
  if (new RegExp(`^\\s+${key}:`, 'mu').test(compose)) {
    return compose;
  }
  const lines = compose.split('\n');
  const last = lines.findLastIndex((line) => /^\s+[A-Z0-9_]+_POSTGRES_DB: /u.test(line));
  if (last === -1) {
    throw new Error('docker-compose.yml has no *_POSTGRES_DB entry to add the database next to');
  }
  const indent = lines[last].slice(0, lines[last].length - lines[last].trimStart().length);
  lines.splice(last + 1, 0, `${indent}${key}: \${${key}:-lightproject_${to.snake}}`);
  return lines.join('\n');
};

const isText = (buffer: Buffer) => !buffer.includes(0);

const copyTemplate = (
  sourceDir: string,
  targetDir: string,
  transform: (relativePath: string, text: string) => string,
) => {
  fs.cpSync(sourceDir, targetDir, {
    filter: (source) =>
      !excludedNames.has(path.basename(source)) && !fs.lstatSync(source).isSymbolicLink(),
    recursive: true,
  });
  for (const entry of fs.readdirSync(targetDir, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      const file = path.join(entry.parentPath, entry.name);
      const buffer = fs.readFileSync(file);
      if (isText(buffer)) {
        fs.writeFileSync(file, transform(path.relative(targetDir, file), buffer.toString('utf8')));
      }
    }
  }
};

const scaffold = ({
  name,
  rootDir,
  type,
  write = (text) => globalThis.process.stdout.write(text),
}: ScaffoldOptions) => {
  assertName(name);
  const spec = templates[type];
  const from = toNames(type);
  const to = toNames(name);
  const sourceDir = path.join(rootDir, 'templates', type);
  const targetDir = path.join(rootDir, spec.group, name);
  if (fs.existsSync(targetDir)) {
    throw new Error(`${path.relative(rootDir, targetDir)} already exists`);
  }

  const envExamplePath = path.join(rootDir, '.env.example');
  const envExample = fs.readFileSync(envExamplePath, 'utf8');
  assertFreePrefix(envExample, to);
  const ports = allocatePorts(spec.ports, to, envExample);

  write(`Scaffolding ${type} as ${spec.group}/${name}…\n`);
  copyTemplate(sourceDir, targetDir, (relativePath, text) => {
    let next = renameText(text, from, to, ports, `${spec.group}/${name}`);
    if (relativePath.endsWith('.md')) {
      next = stripTemplateOnly(next);
    }
    if (type === 'datastore' && relativePath === 'wrangler.toml') {
      next = resetRemoteD1s(next, to);
    }
    return next;
  });

  const { added, text } = addEnvExampleKeys(envExample, from, to, ports);
  fs.writeFileSync(envExamplePath, text);
  write(
    added.length > 0
      ? `.env.example: added ${added.join(', ')}\n`
      : `.env.example: ${to.upper}_* keys already present\n`,
  );

  if (type === 'datastore') {
    const composePath = path.join(rootDir, 'docker-compose.yml');
    fs.writeFileSync(composePath, addComposeDatabase(fs.readFileSync(composePath, 'utf8'), to));
    write(`docker-compose.yml: postgres creates lightproject_${to.snake}\n`);
  }

  const checklist = [
    'vp install',
    `vp check --fix ${spec.group}/${name} (re-sorts keys the rename moved)`,
    `dagger/src/helpers/constants.ts: add '@lightproject/${name}' to WORKSPACES (path '${spec.group}/${name}')`,
    `.github/workflows/verify.yml: add ${name} to \`all-workspaces\` and add its job`,
    `.github/workflows/release.yml: add ${spec.group}/${name}/package.json to the bump list`,
    `sonar-project.properties: add ${spec.group}/${name}/coverage/lcov.info`,
    `tsconfig.madge.json: add the @lightproject/${name} paths`,
    ...spec.checklist,
  ].map((item) => item.replaceAll('<name>', name).replaceAll('<NAME>', to.upper));
  write(`\nNext steps:\n${checklist.map((item) => `- [ ] ${item}`).join('\n')}\n`);
};

const runCli = (type: TemplateType) => {
  scaffold({
    name: globalThis.process.argv[2] ?? '',
    rootDir: path.resolve(import.meta.dirname, '..'),
    type,
  });
};

export {
  addComposeDatabase,
  addEnvExampleKeys,
  allocatePorts,
  assertFreePrefix,
  assertName,
  copyTemplate,
  deployChecklist,
  escapeRegExp,
  excludedNames,
  isText,
  keyOf,
  portRangeStart,
  renameText,
  reservedAppNames,
  reservedNames,
  resetRemoteD1s,
  runCli,
  scaffold,
  stripTemplateOnly,
  templates,
  toNames,
  usedPorts,
};
export type { Names, ScaffoldOptions, TemplateSpec, TemplateType };
