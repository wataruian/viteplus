import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';

const FORCE_KILL_GRACE_PERIOD_MS = 5000;

const isProd = globalThis.process.argv[2] === 'true';
const isWrangler = globalThis.process.argv[3] === 'true';

const storybookPort = Math.trunc(Number(globalThis.process.env['STORYBOOK_PORT'] ?? '6006'));
const designSystemPort = Math.trunc(Number(globalThis.process.env['DESIGN_SYSTEM_PORT'] ?? '6007'));

const viteCommand = isProd ? 'preview' : 'dev';

globalThis.console.log(
  isWrangler
    ? `[wrangler] Starting Design System (${designSystemPort}) and Storybook (${storybookPort})...`
    : `[${viteCommand}] Starting Design System (${designSystemPort}) and Storybook (${storybookPort})...`,
);

const vpBin = path.join(globalThis.process.cwd(), 'node_modules', '.bin', 'vp');

const designSystemCommand = isWrangler
  ? [
      'exec',
      'wrangler',
      'dev',
      '--config',
      'wrangler.design-system.toml',
      '--port',
      String(designSystemPort),
      '--inspector-port',
      '9229',
      '--persist-to',
      '.wrangler/state/design-system',
      '--show-interactive-dev-session=false',
    ]
  : [viteCommand];

const vite = spawn(vpBin, designSystemCommand, {
  shell: true,
  stdio: 'inherit',
});

const resolveStorybookCommand = (): string[] => {
  if (isWrangler) {
    return [
      'exec',
      'wrangler',
      'dev',
      '--config',
      'wrangler.storybook.toml',
      '--port',
      String(storybookPort),
      '--inspector-port',
      '9230',
      '--persist-to',
      '.wrangler/state/storybook',
      '--show-interactive-dev-session=false',
    ];
  }

  if (isProd) {
    return ['preview', '--outDir', 'storybook-static', '--port', String(storybookPort)];
  }

  return ['exec', 'storybook', 'dev', '-p', String(storybookPort), '--no-open'];
};

const storybookCommand = resolveStorybookCommand();

const storybook = spawn(vpBin, storybookCommand, {
  shell: true,
  stdio: 'inherit',
});

const collectDescendantPids = (rootPid: number): number[] => {
  const pids = [rootPid];

  const getChildPids = (): number[] => {
    try {
      return execFileSync('pgrep', ['-P', String(rootPid)])
        .toString()
        .split('\n')
        .map((line) => Number(line.trim()))
        .filter((pid) => Number.isFinite(pid) && pid > 0);
    } catch {
      return [];
    }
  };

  const childPids = getChildPids();

  for (const childPid of childPids) {
    pids.push(...collectDescendantPids(childPid));
  }

  return pids;
};

const isPidAlive = (pid: number): boolean => {
  try {
    globalThis.process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

let cleaningUp = false;

const cleanup = () => {
  if (cleaningUp) {
    return;
  }

  cleaningUp = true;

  const descendantPids = [
    ...(vite.pid === undefined ? [] : collectDescendantPids(vite.pid)),
    ...(storybook.pid === undefined ? [] : collectDescendantPids(storybook.pid)),
  ];

  vite.kill();
  storybook.kill();

  if (isWrangler) {
    const deadline = Date.now() + FORCE_KILL_GRACE_PERIOD_MS;

    while (Date.now() < deadline && descendantPids.some((pid) => isPidAlive(pid))) {
      try {
        execFileSync('sleep', ['0.2']);
      } catch {
        break;
      }
    }

    for (const pid of descendantPids) {
      try {
        globalThis.process.kill(pid, 'SIGKILL');
      } catch {
        // Already gone.
      }
    }
  }

  globalThis.process.exit();
};

const signals = ['SIGTERM', 'SIGINT', 'SIGHUP'];

for (const signal of signals) {
  globalThis.process.once(signal, () => {
    cleanup();
  });
}
