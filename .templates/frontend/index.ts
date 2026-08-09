#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

const templateDir = path.join(import.meta.dirname, 'template');
const targetDir = globalThis.process.argv[2]
  ? path.resolve(globalThis.process.cwd(), globalThis.process.argv[2])
  : globalThis.process.cwd();

globalThis.console.log(`Scaffolding frontend template in ${targetDir}...`);
fs.cpSync(templateDir, targetDir, { recursive: true });
globalThis.console.log('Done! 🚀');
