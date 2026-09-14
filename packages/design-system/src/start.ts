import { spawn } from 'node:child_process';
import path from 'node:path';

const isProd = globalThis.process.argv[2] === 'true';

const storybookPort = Math.trunc(Number(globalThis.process.env['STORYBOOK_PORT'] ?? '6006'));
const designSystemPort = Math.trunc(Number(globalThis.process.env['DESIGN_SYSTEM_PORT'] ?? '6007'));

const viteCommand = isProd ? 'preview' : 'dev';

globalThis.console.log(
  `[${viteCommand}] Starting Design System (${designSystemPort}) and Storybook (${storybookPort})...`,
);

const vpBin = path.join(globalThis.process.cwd(), 'node_modules', '.bin', 'vp');

const vite = spawn(vpBin, [viteCommand], {
  shell: true,
  stdio: 'inherit',
});

const storybookCommand = isProd
  ? ['preview', '--outDir', 'storybook-static', '--port', String(storybookPort)]
  : ['exec', 'storybook', 'dev', '-p', String(storybookPort), '--no-open'];

const storybook = spawn(vpBin, [...storybookCommand], {
  shell: true,
  stdio: 'inherit',
});

const cleanup = () => {
  vite.kill();
  storybook.kill();
  globalThis.process.exit();
};

const signals = ['SIGTERM', 'SIGINT', 'SIGHUP'];

for (const signal of signals) {
  globalThis.process.once(signal, () => {
    cleanup();
  });
}
