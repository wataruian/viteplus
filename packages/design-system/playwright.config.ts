import { defineConfig, devices } from '@playwright/test';

import { previewAppPort, previewAppUrl, storybookPort } from './tests/e2e/ports';

export default defineConfig({
  forbidOnly: true,
  fullyParallel: false,
  outputDir: 'tmp/e2e/results',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: [
    ['list'],
    ['json', { outputFile: 'tmp/e2e/results.json' }],
    ['html', { open: 'never', outputFolder: 'tmp/e2e/report' }],
  ],
  retries: 0,
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${storybookPort}`,
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    video: 'on',
  },
  webServer: [
    {
      command: `storybook dev -p ${storybookPort} --ci --no-open`,
      reuseExistingServer: false,
      timeout: 180_000,
      url: `http://localhost:${storybookPort}/index.json`,
    },
    {
      command: `vp dev --port ${previewAppPort} --strictPort`,
      reuseExistingServer: false,
      timeout: 180_000,
      url: previewAppUrl,
    },
  ],
  workers: 1,
});
