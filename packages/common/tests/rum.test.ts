import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { flushRum, registerLifecycleFlush } from '../src/utils/rum';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('flushRum', () => {
  test('resolves without throwing when no meter provider has been initialized', async () => {
    await expect(flushRum()).resolves.toBeUndefined();
  });
});

describe('registerLifecycleFlush', () => {
  test('does nothing outside a browser environment (no window/document)', () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);

    expect(() => {
      registerLifecycleFlush();
    }).not.toThrow();
  });
});
