import { spawn } from 'node:child_process';

const isProd = globalThis.process.argv[2] === 'true';

const storybookPort = Math.trunc(Number(globalThis.process.env['STORYBOOK_PORT'] ?? '6006'));
const designSystemPort = Math.trunc(Number(globalThis.process.env['DESIGN_SYSTEM_PORT'] ?? '6007'));

const viteCommand = isProd ? 'preview' : 'dev';

globalThis.console.log(
  `[${viteCommand}] Starting Design System (${designSystemPort}) and Storybook (${storybookPort})...`,
);

const vite = spawn('vp', [viteCommand], {
  shell: true,
  stdio: 'inherit',
});

const storybook = spawn(
  'vp',
  ['exec', 'storybook', 'dev', '-p', String(storybookPort), '--no-open'],
  {
    shell: true,
    stdio: 'inherit',
  },
);

const cleanup = () => {
  vite.kill();
  storybook.kill();
  globalThis.process.exit();
};

globalThis.process.on('SIGINT', cleanup);
globalThis.process.on('SIGTERM', cleanup);
