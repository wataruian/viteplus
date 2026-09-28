import { defineConfig, devices } from '@playwright/test';

const port = Math.trunc(Number(globalThis.process.env['STORYBOOK_E2E_PORT'] ?? '6116'));

export default defineConfig({
  forbidOnly: true,
  fullyParallel: false,
  outputDir: 'tmp/e2e/results',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: [['list']],
  retries: 0,
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${port}`,
    colorScheme: 'dark',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `storybook dev -p ${port} --ci --no-open`,
    reuseExistingServer: false,
    timeout: 180_000,
    url: `http://localhost:${port}/index.json`,
  },
  workers: 1,
});
