import type { LogEntry } from '@lightproject/common/logger';
import { initializeContextPropagation, resetTelemetryForTests } from '@lightproject/common/server';
import { describe, expect, test, vi } from 'vite-plus/test';

import { counterRef, setupCounter } from '../../src/counter';

describe('counterRef', () => {
  test('sets up the counter on attach and returns a cleanup that detaches its click listener', () => {
    const button = globalThis.document.createElement('button');
    const cleanup = counterRef(button);
    expect(button.textContent).toBe('Count is 0');

    button.click();
    expect(button.textContent).toBe('Count is 1');

    cleanup?.();
    button.click();
    expect(button.textContent).toBe('Count is 1');
  });

  test('does nothing when called with null', () => {
    expect(counterRef(null)).toBeUndefined();
  });
});

describe('setupCounter', () => {
  test('sets the initial text content to "Count is 0"', () => {
    const button = globalThis.document.createElement('button');
    const cleanup = setupCounter(button);
    expect(button.textContent).toBe('Count is 0');
    cleanup();
  });

  test('increments the count and updates the text content on each click', () => {
    const button = globalThis.document.createElement('button');
    const cleanup = setupCounter(button);

    button.click();
    expect(button.textContent).toBe('Count is 1');

    button.click();
    button.click();
    expect(button.textContent).toBe('Count is 3');

    cleanup();
  });

  test('the returned cleanup function stops further clicks from incrementing the count', () => {
    const button = globalThis.document.createElement('button');
    const cleanup = setupCounter(button);

    button.click();
    expect(button.textContent).toBe('Count is 1');

    cleanup();
    button.click();
    expect(button.textContent).toBe('Count is 1');
  });

  test('each call to setupCounter tracks its own independent count', () => {
    const buttonA = globalThis.document.createElement('button');
    const buttonB = globalThis.document.createElement('button');
    const cleanupA = setupCounter(buttonA);
    const cleanupB = setupCounter(buttonB);

    buttonA.click();
    buttonA.click();
    buttonB.click();

    expect(buttonA.textContent).toBe('Count is 2');
    expect(buttonB.textContent).toBe('Count is 1');

    cleanupA();
    cleanupB();
  });

  test('every click is its own operation with a fresh requestId', async () => {
    vi.resetModules();
    vi.stubEnv('LOG_LEVEL', 'info');
    vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
    initializeContextPropagation();
    const { registerBrowserLogSink } = await import('@lightproject/common/logger');
    const { setupCounter: setupFreshCounter } = await import('../../src/counter');
    const pushLog = vi.fn<(entry: LogEntry) => void>();
    registerBrowserLogSink({ pushLog });
    const button = globalThis.document.createElement('button');
    const cleanup = setupFreshCounter(button);
    try {
      button.click();
      button.click();

      const requestIds = pushLog.mock.calls
        .filter(([entry]) => entry.message === 'Counter incremented')
        .map(([entry]) => entry.requestId);
      expect(requestIds).toHaveLength(2);
      expect(requestIds[0]).toEqual(expect.any(String));
      expect(requestIds[1]).not.toBe(requestIds[0]);
    } finally {
      cleanup();
      registerBrowserLogSink(undefined);
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
      resetTelemetryForTests();
    }
  });
});
