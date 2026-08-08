import { type ASTNode, compileStylesRegistry, extractStylesFromFile } from './style-compiler';
import fg from 'fast-glob';
import fs from 'node:fs';
import { inspect } from 'node:util';
import path from 'node:path';

const envPath = path.resolve(import.meta.dirname, '../../../../.env');

const componentsGlob = path.resolve(import.meta.dirname, '../components/**/*.tsx');

const files = fg.globSync(componentsGlob);

const raw: Record<string, ASTNode> = {};
for (const file of files) {
  Object.assign(raw, extractStylesFromFile(file));
}

const stylesRegistry = compileStylesRegistry(raw);

const styles = {
  raw,
  stylesRegistry,
};

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

  if (globalThis.process.env['STYLE_COMPILE_DEBUG'] === 'true') {
    globalThis.console.log(
      'styles',
      inspect(styles, {
        colors: true,
        depth: null,
      }),
    );
  }
}

export { componentsGlob, files, raw, stylesRegistry, styles };
