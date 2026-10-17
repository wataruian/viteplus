import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test';

import {
  getEnv,
  hasEnvProperty,
  isBrowser,
  isEdge,
  isFalse,
  isNode,
} from '../../src/environment/env';
import { getImportMetaEnvValue } from '../../src/environment/import-meta-env.node';

describe('Environment Helpers', () => {
  beforeEach(() => {
    vi.stubEnv('CI', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getEnv', () => {
    test('getEnv should return the variable value', () => {
      vi.stubEnv('ANY_VAR', 'any_value');
      expect(getEnv('ANY_VAR')).toBe('any_value');
    });

    test('getEnv should return undefined for non-existent variable', () => {
      expect(getEnv('NON_EXISTENT_ET92')).toBeUndefined();
    });

    test('getEnv should return the provided default value when unset', () => {
      expect(getEnv('NON_EXISTENT_ET93', 'fallback-value')).toBe('fallback-value');
    });

    test('getEnv should fall back to the VITE_ prefixed variable', () => {
      vi.stubEnv('ET94_KEY', undefined);
      vi.stubEnv('VITE_ET94_KEY', 'from-vite');
      expect(getEnv('ET94_KEY')).toBe('from-vite');
    });

    test('getEnv should prefer the unprefixed variable over the VITE_ one', () => {
      vi.stubEnv('ET95_KEY', 'from-plain');
      vi.stubEnv('VITE_ET95_KEY', 'from-vite');
      expect(getEnv('ET95_KEY')).toBe('from-plain');
    });

    test('getEnv should not double the VITE_ prefix for already prefixed keys', () => {
      vi.stubEnv('VITE_ET96_KEY', undefined);
      vi.stubEnv('VITE_VITE_ET96_KEY', 'doubled');
      expect(getEnv('VITE_ET96_KEY')).toBeUndefined();
    });

    test('getEnv should return the default value when neither variable is set', () => {
      expect(getEnv('NON_EXISTENT_ET97', 'fallback-value')).toBe('fallback-value');
    });
  });

  describe('import-meta-env.node stub', () => {
    test('always returns undefined, regardless of the key', () => {
      expect(getImportMetaEnvValue('ANY_VAR')).toBeUndefined();
    });
  });

  describe('import-meta-env (real browser implementation)', () => {
    test('reads straight off import.meta.env', async () => {
      vi.doUnmock('#import-meta-env');
      vi.resetModules();
      const { getImportMetaEnvValue: realGetImportMetaEnvValue } =
        await import('../../src/environment/import-meta-env');

      expect(realGetImportMetaEnvValue('MODE')).toBe('test');
      expect(realGetImportMetaEnvValue('REAL_IMPORT_META_ENV_MISSING_KEY')).toBeUndefined();

      vi.doMock('#import-meta-env', () => ({ getImportMetaEnvValue: () => undefined }));
      vi.resetModules();
    });
  });

  describe('getEnv browser (import.meta.env) fallback', () => {
    test('returns the import.meta.env value when process.env lacks the key', async () => {
      vi.resetModules();
      vi.doMock('#import-meta-env', () => ({
        getImportMetaEnvValue: (key: string) =>
          key === 'ONLY_IN_IMPORT_META' ? 'from-import-meta' : undefined,
      }));
      const { getEnv: getEnvWithMockedImportMeta } = await import('../../src/environment/env');

      expect(getEnvWithMockedImportMeta('ONLY_IN_IMPORT_META')).toBe('from-import-meta');

      vi.doUnmock('#import-meta-env');
      vi.resetModules();
    });
  });

  describe('hasEnvProperty', () => {
    test('returns true when the object has an env property', () => {
      expect(hasEnvProperty({ env: { FOO: 'bar' } })).toBe(true);
    });

    test('returns false when the object has no env property', () => {
      expect(hasEnvProperty({})).toBe(false);
    });
  });

  describe('isBrowser', () => {
    test('should return true if window and document are defined', () => {
      vi.stubGlobal('window', {});
      vi.stubGlobal('document', {});
      expect(isBrowser()).toBe(true);
      vi.unstubAllGlobals();
    });

    test('should return false if window or document is undefined', () => {
      vi.stubGlobal('window', undefined);
      vi.stubGlobal('document', undefined);
      expect(isBrowser()).toBe(false);
      vi.unstubAllGlobals();
    });
  });

  describe('isEdge', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    test('is false in a normal Node test environment', () => {
      expect(isEdge()).toBe(false);
    });

    test('is true when EdgeRuntime is present', () => {
      vi.stubGlobal('EdgeRuntime', 'edge-light');
      expect(isEdge()).toBe(true);
    });

    test('is true when Deno is present', () => {
      vi.stubGlobal('Deno', {});
      expect(isEdge()).toBe(true);
    });

    test('is true when navigator.userAgent is Cloudflare-Workers', () => {
      vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });
      expect(isEdge()).toBe(true);
    });
  });

  describe('isNode', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    test('is true in a normal Node test environment', () => {
      expect(isNode()).toBe(true);
    });

    test('is false when isEdge() is true', () => {
      vi.stubGlobal('Deno', {});
      expect(isNode()).toBe(false);
    });
  });

  describe('isFalse', () => {
    test('treats an empty value as false-ish', () => {
      expect(isFalse('')).toBe(true);
    });

    test('treats "false" (any case) and "0" as false-ish', () => {
      expect(isFalse('false')).toBe(true);
      expect(isFalse('FALSE')).toBe(true);
      expect(isFalse('0')).toBe(true);
    });

    test('treats any other value as not false-ish', () => {
      expect(isFalse('true')).toBe(false);
      expect(isFalse('1')).toBe(false);
    });
  });
});
