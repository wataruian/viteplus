import type { Mode } from '../src/context/mode-context';

const modeChangedEvent = 'lightproject/mode-changed';
const modeStorageKey = 'lightproject-storybook-mode';
const defaultMode: Mode = 'dark';

const isMode = (value: string | null): value is Mode => value === 'light' || value === 'dark';

const readStoredMode = (): Mode => {
  try {
    const stored = globalThis.localStorage.getItem(modeStorageKey);
    return isMode(stored) ? stored : defaultMode;
  } catch {
    return defaultMode;
  }
};

const storeMode = (mode: Mode) => {
  try {
    globalThis.localStorage.setItem(modeStorageKey, mode);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the mode still applies for this session.
  }
};

export { defaultMode, isMode, modeChangedEvent, modeStorageKey, readStoredMode, storeMode };
