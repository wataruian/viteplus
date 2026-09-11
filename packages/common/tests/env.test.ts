import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import {
  getEnv,
  getEnvName,
  getLogFormat,
  getLogLevel,
  hasEnvProperty,
  isBrowser,
  isCi,
  isDebug,
  isDevelop,
  isDevelopOrStagingOrProduction,
  isEdge,
  isFalse,
  isLocal,
  isLocalOrTest,
  isNode,
  isNodeEnvTest,
  isNonProduction,
  isOtherEnvironment,
  isProduction,
  isStaging,
  isTest,
  isVitest,
} from '../src/environment/env';

describe('Environment Helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Environment Mode and Config', () => {
    test.each([
      { fn: () => getEnv('ANY_VAR'), key: 'ANY_VAR', label: 'getEnv', value: 'any_value' },
      { fn: getEnvName, key: 'ENV', label: 'getEnvName', value: 'DEVELOP' },
      { fn: getLogFormat, key: 'LOG_FORMAT', label: 'getLogFormat', value: 'json' },
      { fn: getLogLevel, key: 'LOG_LEVEL', label: 'getLogLevel', value: 'debug' },
    ])('should correctly handle $label', ({ fn, key, value }) => {
      vi.stubEnv(key, value);
      const result = fn();
      expect(typeof result === 'string' ? result.toLowerCase() : result).toBe(value.toLowerCase());
    });

    test('getEnvName should default to local', () => {
      vi.stubEnv('ENV', undefined);
      vi.stubEnv('VITE_ENV', undefined);
      expect(getEnvName()).toBe('local');
    });

    test('getEnvName should fall back to VITE_ENV when ENV is unset', () => {
      vi.stubEnv('ENV', undefined);
      vi.stubEnv('VITE_ENV', 'STAGING');
      expect(getEnvName()).toBe('staging');
    });

    test('getEnv should return undefined for non-existent variable', () => {
      expect(getEnv('NON_EXISTENT_ET92')).toBeUndefined();
    });

    test('getEnv should return the provided default value when unset', () => {
      expect(getEnv('NON_EXISTENT_ET93', 'fallback-value')).toBe('fallback-value');
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

  describe('Environment Checks', () => {
    test.each([
      ['local', isLocal],
      ['develop', isDevelop],
      ['staging', isStaging],
      ['production', isProduction],
      ['test', isTest],
    ])('should correctly identify %s environment', (env, checkFn) => {
      vi.stubEnv('ENV', env);
      expect(checkFn()).toBe(true);
      vi.stubEnv('ENV', env === 'local' ? 'test' : 'local');
      expect(checkFn()).toBe(false);
    });

    test('isLocalOrTest', () => {
      vi.stubEnv('ENV', 'local');
      expect(isLocalOrTest()).toBe(true);
      vi.stubEnv('ENV', 'test');
      expect(isLocalOrTest()).toBe(true);
      vi.stubEnv('ENV', 'develop');
      expect(isLocalOrTest()).toBe(false);
    });

    test('isDevelopOrStagingOrProduction', () => {
      for (const env of ['develop', 'staging', 'production']) {
        vi.stubEnv('ENV', env);
        expect(isDevelopOrStagingOrProduction()).toBe(true);
      }
      vi.stubEnv('ENV', 'local');
      expect(isDevelopOrStagingOrProduction()).toBe(false);
    });
  });

  describe('Boolean Helpers', () => {
    test.each([
      ['isCi', 'CI', isCi],
      ['isDebug', 'DEBUG', isDebug],
    ])('%s should handle truthy and falsy values', (_label, envKey, checkFn) => {
      for (const truthy of ['true', '1']) {
        vi.stubEnv(envKey, truthy);
        expect(checkFn()).toBe(true);
      }
      vi.stubEnv(envKey, 'false');
      expect(checkFn()).toBe(false);
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

  describe('isNodeEnvTest', () => {
    test('reflects NODE_ENV', () => {
      vi.stubEnv('NODE_ENV', 'test');
      expect(isNodeEnvTest()).toBe(true);
      vi.stubEnv('NODE_ENV', 'production');
      expect(isNodeEnvTest()).toBe(false);
    });
  });

  describe('isVitest', () => {
    test('reflects the VITEST env var', () => {
      vi.stubEnv('VITEST', 'true');
      expect(isVitest()).toBe(true);
      vi.stubEnv('VITEST', 'false');
      expect(isVitest()).toBe(false);
    });
  });

  describe('isNonProduction', () => {
    test('is true for test/local/develop/staging and false for production', () => {
      for (const env of ['test', 'local', 'develop', 'staging']) {
        vi.stubEnv('ENV', env);
        expect(isNonProduction()).toBe(true);
      }
      vi.stubEnv('ENV', 'production');
      expect(isNonProduction()).toBe(false);
    });
  });

  describe('isOtherEnvironment', () => {
    test('is true for an unrecognized ENV value', () => {
      vi.stubEnv('ENV', 'qa-custom');
      expect(isOtherEnvironment()).toBe(true);
    });

    test('is false for a recognized ENV value', () => {
      vi.stubEnv('ENV', 'production');
      expect(isOtherEnvironment()).toBe(false);
    });

    test('matches against a specific expected environment name when provided', () => {
      vi.stubEnv('ENV', 'qa-custom');
      expect(isOtherEnvironment('qa-custom')).toBe(true);
      expect(isOtherEnvironment('qa-different')).toBe(false);
    });
  });
});
