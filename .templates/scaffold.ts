/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const scaffold = (type: string) => {
  const currentDir = import.meta.dirname;
  const rootDir = path.resolve(currentDir, '..');

  const getTemplateDir = (t: string) => {
    switch (t) {
      case 'library': {
        return path.join(rootDir, 'packages', 'library');
      }
      case 'frontend': {
        return path.join(rootDir, 'apps', 'frontend');
      }
      case 'backend': {
        return path.join(rootDir, 'apps', 'backend');
      }
      default: {
        throw new Error(`Unknown type: ${t}`);
      }
    }
  };

  const templateDir = getTemplateDir(type);

  const { 2: targetArg } = process.argv;
  const targetDir =
    typeof targetArg === 'string' ? path.resolve(process.cwd(), targetArg) : process.cwd();

  process.stdout.write(`Scaffolding ${type} template in ${targetDir}...\n`);

  fs.cpSync(templateDir, targetDir, {
    filter: (src: string) => {
      const base = path.basename(src);
      return (
        base !== 'node_modules' &&
        base !== 'dist' &&
        base !== 'coverage' &&
        base !== 'tmp' &&
        base !== 'tsconfig.tsbuildinfo'
      );
    },
    recursive: true,
  });

  if (typeof targetArg === 'string') {
    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkgText = fs.readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(pkgText) as unknown;

      if (typeof pkg === 'object' && pkg !== null) {
        Object.assign(pkg, { name: `@lightproject/${targetArg}` });
        fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
      }
    }
  }

  process.stdout.write('Done! 🚀\n');
};

export { scaffold };
