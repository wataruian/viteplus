import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import {
  getEnv,
  getEnvironmentMode,
  getLogFormat,
  getLogLevel,
  isBrowser,
  isCi,
  isDebug,
  isDevelop,
  isDevelopOrStagingOrProduction,
  isLocal,
  isLocalOrTest,
  isProduction,
  isStaging,
  isTest,
} from '../src/environment/env';

describe('Environment Helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Environment Mode and Config', () => {
    test.each([
      { fn: () => getEnv('ANY_VAR'), key: 'ANY_VAR', label: 'getEnv', value: 'any_value' },
      { fn: getEnvironmentMode, key: 'ENV', label: 'getEnvironmentMode', value: 'DEVELOP' },
      { fn: getLogFormat, key: 'LOG_FORMAT', label: 'getLogFormat', value: 'json' },
      { fn: getLogLevel, key: 'LOG_LEVEL', label: 'getLogLevel', value: 'debug' },
    ])('should correctly handle $label', ({ fn, key, value }) => {
      vi.stubEnv(key, value);
      const result = fn();
      expect(typeof result === 'string' ? result.toLowerCase() : result).toBe(value.toLowerCase());
    });

    test('getEnvironmentMode should default to local', () => {
      vi.stubEnv('ENV', undefined);
      expect(getEnvironmentMode()).toBe('local');
    });

    test('getEnv should return undefined for non-existent variable', () => {
      expect(getEnv('NON_EXISTENT_ET92')).toBeUndefined();
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
});
