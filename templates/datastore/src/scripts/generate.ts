import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import * as postgres from '../postgres/schema';
import { generateMigrations, migrationNameArgument, packageDir } from './migrations';
import { d1RenderedModules, renderD1Query } from './render-d1-queries';
import { renderD1Schema } from './render-d1-schema';

interface GeneratedFile {
  source: string;
  target: string;
  render: () => string;
}

const vp = path.join(packageDir, 'node_modules/.bin/vp');

const resolve = (file: string) => path.resolve(packageDir, file);

const generatedFiles: readonly GeneratedFile[] = [
  {
    render: () => renderD1Schema(postgres),
    source: 'src/postgres/schema.ts',
    target: 'src/d1/schema.ts',
  },
  ...d1RenderedModules.map((file) => ({
    render: () => renderD1Query(file, fs.readFileSync(resolve(`src/postgres/${file}`), 'utf8')),
    source: `src/postgres/${file}`,
    target: `src/d1/${file}`,
  })),
];

const syncGeneratedFile = ({ render, source, target }: GeneratedFile) => {
  const file = resolve(target);
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  fs.writeFileSync(file, render());
  try {
    execFileSync(vp, ['check', '--fix', file], { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    const output =
      error instanceof Error && 'stdout' in error && 'stderr' in error
        ? `${String(error.stdout)}${String(error.stderr)}`
        : '';
    throw new Error(`generated ${target} does not pass \`vp check\`:\n${output}`, {
      cause: error,
    });
  }
  const after = fs.readFileSync(file, 'utf8');
  globalThis.process.stdout.write(
    before === after
      ? `${target} already in sync with ${source}\n`
      : `${target} updated from ${source}\n`,
  );
};

try {
  for (const generated of generatedFiles) {
    syncGeneratedFile(generated);
  }
  generateMigrations(migrationNameArgument());
} catch (error) {
  const reason = error instanceof Error ? error.message : JSON.stringify(error);
  globalThis.process.stderr.write(`db:generate failed: ${reason}\n`);
  globalThis.process.exit(1);
}

export { generatedFiles, resolve, syncGeneratedFile, vp };
export type { GeneratedFile };
