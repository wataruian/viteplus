import path from 'node:path';

import { unstable_dev } from 'wrangler';

const wranglerEntryPath = path.resolve(
  import.meta.dirname,
  '../../../backend/src/runtimes/edge.ts',
);
const wranglerConfigPath = path.resolve(import.meta.dirname, '../../../backend/wrangler.toml');

export default async function setup(): Promise<() => Promise<void>> {
  const worker = await unstable_dev(wranglerEntryPath, {
    config: wranglerConfigPath,
    experimental: { disableExperimentalWarning: true },
    ip: '127.0.0.1',
    local: true,
    logLevel: 'none',
    persist: false,
  });

  globalThis.process.env['WRANGLER_TEST_BASE_URL'] = `http://${worker.address}:${worker.port}`;

  return async () => {
    await worker.stop();
  };
}
