const createStorageManager = <T>(
  key: string,
  defaultValue: T
): {
  defaultValue: T;
  isAvailable: () => boolean;
  load: () => null | T;
  remove: () => void;
  safeLoad: () => null | T;
  safeSave: (value: T) => void;
  save: (value: T) => void;
} => {
  const safeLoad = (): null | T => {
    if (!isStorageAvailable()) {
      console.warn(`Cannot load ${key}: localStorage not available`);
      return null;
    }

    try {
      const storedValue = localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : null;
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      return null;
    }
  };

  const safeSave = (value: T): void => {
    if (!isStorageAvailable()) {
      console.warn(`Cannot save ${key}: localStorage not available`);
      return;
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  };

  const safeRemove = (): void => {
    if (!isStorageAvailable()) {
      console.warn(`Cannot remove ${key}: localStorage not available`);
      return;
    }

    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing ${key} from localStorage:`, error);
    }
  };

  return {
    defaultValue,
    isAvailable: isStorageAvailable,
    load: safeLoad,
    remove: safeRemove,
    safeLoad,
    safeSave,
    save: safeSave,
  };
};

const isStorageAvailable = (): boolean => {
  try {
    // Check if localStorage is available and not blocked
    return (
      typeof globalThis !== 'undefined' &&
      globalThis.localStorage !== undefined &&
      globalThis.localStorage !== null
    );
  } catch (error) {
    console.warn('localStorage is not available:', error);
    return false;
  }
};

export { createStorageManager, isStorageAvailable };
