import { defineConfig } from 'vitest/config';

const TEST_TIMEOUT_SECONDS = 30;
const MILLISECONDS_PER_SECOND = 1000;

export default defineConfig({
  test: {
    coverage: {
      clean: true,
      cleanOnRerun: true,
      enabled: true,
      include: ['./src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'clover', 'lcov', 'json'],
      reportsDirectory: './coverage',
    },
    css: true,
    environment: 'jsdom',
    globals: true,
    onConsoleLog() {
      return false;
    },
    retry: 3,
    setupFiles: './vitest.setup.ts',
    // testTimeout: 60 * 60 * 1000,
    testTimeout: TEST_TIMEOUT_SECONDS * MILLISECONDS_PER_SECOND,
  },
});
