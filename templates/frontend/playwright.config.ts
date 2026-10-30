import { defineConfig, devices } from '@playwright/test';

const port = Math.trunc(Number(globalThis.process.env['FRONTEND_E2E_PORT'] ?? '2111'));

export { port };

export default defineConfig({
  forbidOnly: true,
  fullyParallel: false,
  outputDir: 'e2e-test-results/results',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e-test-results/results.json' }],
    ['html', { open: 'never', outputFolder: 'e2e-test-results/report' }],
  ],
  retries: 0,
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${port}`,
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    video: 'on',
  },
  webServer: {
    command: `vp build && vp preview --port ${port} --strictPort`,
    reuseExistingServer: false,
    timeout: 300_000,
    url: `http://localhost:${port}/preview`,
  },
  workers: 1,
});
