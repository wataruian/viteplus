import fs from 'node:fs';
import path from 'node:path';
import { inspect } from 'node:util';

import fg from 'fast-glob';

import {
  type ASTNode,
  compileStylesRegistry,
  extractStylesFromFile,
  sortKeysDeep,
} from './style-compiler';

const envPath = path.resolve(import.meta.dirname, '../../../../.env');

const componentsGlob = path.resolve(import.meta.dirname, '../components/**/*.tsx');

const files = fg.globSync(componentsGlob);

const raw: Record<string, ASTNode> = {};
for (const file of files) {
  Object.assign(raw, extractStylesFromFile(file));
}

const stylesRegistry = compileStylesRegistry(raw);

const unsortedStyles = {
  raw,
  stylesRegistry,
};

const styles = sortKeysDeep(unsortedStyles);

if (typeof globalThis.process.loadEnvFile === 'function' && fs.existsSync(envPath)) {
  try {
    globalThis.process.loadEnvFile(envPath);
  } catch {
    // Silently ignore loading .env file
  }
}

if (import.meta.url === `file://${globalThis.process.argv[1]}`) {
  if (globalThis.process.argv[2] === 'true') {
    globalThis.process.env['STYLE_COMPILE_DEBUG'] = 'true';
  }

  globalThis.console.log('🚀 Compiling styles...');

  const outputDir = path.resolve(import.meta.dirname, '../../tmp/compile');
  const outputFile = path.resolve(outputDir, 'styles.json');

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(styles, undefined, 2));

  if (globalThis.process.env['STYLE_COMPILE_DEBUG'] === 'true') {
    globalThis.console.log(
      'styles',
      inspect(styles, {
        colors: true,
        depth: null,
      }),
    );
  }

  globalThis.console.log('✅ Done compiling styles');
}

export { componentsGlob, files, raw, styles, stylesRegistry };
