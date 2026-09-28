import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import {
  defaultMode,
  isMode,
  modeStorageKey,
  readStoredMode,
  storeMode,
} from '../../.storybook/mode-channel';

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.localStorage.clear();
});

describe('isMode', () => {
  test('accepts only light and dark', () => {
    expect(isMode('light')).toBe(true);
    expect(isMode('dark')).toBe(true);
    expect(isMode('Dark')).toBe(false);
    expect(isMode('')).toBe(false);
    expect(isMode(null)).toBe(false);
  });
});

describe('readStoredMode', () => {
  test('defaults to dark when nothing is stored', () => {
    expect(defaultMode).toBe('dark');
    expect(readStoredMode()).toBe('dark');
  });

  test('returns the persisted mode', () => {
    globalThis.localStorage.setItem(modeStorageKey, 'light');
    expect(readStoredMode()).toBe('light');
  });

  test('ignores an unrecognized persisted value', () => {
    globalThis.localStorage.setItem(modeStorageKey, 'sepia');
    expect(readStoredMode()).toBe('dark');
  });

  test('falls back to the default when storage throws', () => {
    vi.spyOn(globalThis.Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readStoredMode()).toBe('dark');
  });
});

describe('storeMode', () => {
  test('persists the mode so the preview iframe can read it on load', () => {
    storeMode('light');
    expect(globalThis.localStorage.getItem(modeStorageKey)).toBe('light');
    expect(readStoredMode()).toBe('light');
  });

  test('swallows storage errors', () => {
    vi.spyOn(globalThis.Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => {
      storeMode('light');
    }).not.toThrow();
  });
});
