import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test';

const loadVariables = async () => {
  vi.resetModules();
  return await import('../../src/environment/variables');
};

type BooleanCheck =
  | 'isCi'
  | 'isDebug'
  | 'isDevelop'
  | 'isLocal'
  | 'isProduction'
  | 'isStaging'
  | 'isTelemetryDebug'
  | 'isTest'
  | 'isVitest';

const runCheck = async (check: BooleanCheck) => {
  const variables = await loadVariables();
  return variables[check]();
};

describe('environment variables', () => {
  beforeEach(() => {
    vi.stubEnv('CI', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getEnvName', () => {
    test('lowercases ENV', async () => {
      vi.stubEnv('ENV', 'DEVELOP');
      const { getEnvName } = await loadVariables();
      expect(getEnvName()).toBe('develop');
    });

    test('defaults to local', async () => {
      vi.stubEnv('ENV', undefined);
      vi.stubEnv('VITE_ENV', undefined);
      const { getEnvName } = await loadVariables();
      expect(getEnvName()).toBe('local');
    });

    test('treats an empty ENV as unset', async () => {
      vi.stubEnv('ENV', '');
      vi.stubEnv('VITE_ENV', undefined);
      const { getEnvName } = await loadVariables();
      expect(getEnvName()).toBe('local');
    });

    test('falls back to VITE_ENV when ENV is unset', async () => {
      vi.stubEnv('ENV', undefined);
      vi.stubEnv('VITE_ENV', 'STAGING');
      const { getEnvName } = await loadVariables();
      expect(getEnvName()).toBe('staging');
    });
  });

  test.each([
    ['LOG_FORMAT', 'json', 'getLogFormat'],
    ['LOG_LEVEL', 'debug', 'getLogLevel'],
    ['NODE_ENV', 'test', 'getNodeEnv'],
    ['CHALK_LEVEL', '2', 'getChalkLevel'],
  ] as const)('%s is returned by %s', async (key, value, getter) => {
    vi.stubEnv(key, value);
    const variables = await loadVariables();
    expect(variables[getter]()).toBe(value);
  });

  describe('environment checks', () => {
    test.each([
      ['local', 'isLocal'],
      ['develop', 'isDevelop'],
      ['staging', 'isStaging'],
      ['production', 'isProduction'],
      ['test', 'isTest'],
    ] as const)('identifies the %s environment', async (env, check) => {
      vi.stubEnv('ENV', env);
      await expect(runCheck(check)).resolves.toBe(true);
      vi.stubEnv('ENV', env === 'local' ? 'test' : 'local');
      await expect(runCheck(check)).resolves.toBe(false);
    });

    test.each([
      ['local', true],
      ['test', true],
      ['develop', false],
    ])('isLocalOrTest is %s for ENV=%s', async (env, expected) => {
      vi.stubEnv('ENV', env);
      const { isLocalOrTest } = await loadVariables();
      expect(isLocalOrTest()).toBe(expected);
    });

    test.each([
      ['develop', true],
      ['staging', true],
      ['production', true],
      ['local', false],
    ])('isDevelopOrStagingOrProduction for ENV=%s is %s', async (env, expected) => {
      vi.stubEnv('ENV', env);
      const { isDevelopOrStagingOrProduction } = await loadVariables();
      expect(isDevelopOrStagingOrProduction()).toBe(expected);
    });

    test.each([
      ['test', true],
      ['local', true],
      ['develop', true],
      ['staging', true],
      ['production', false],
    ])('isNonProduction for ENV=%s is %s', async (env, expected) => {
      vi.stubEnv('ENV', env);
      const { isNonProduction } = await loadVariables();
      expect(isNonProduction()).toBe(expected);
    });

    test.each([
      ['test', true],
      ['production', false],
    ])('isNodeEnvTest for NODE_ENV=%s is %s', async (nodeEnv, expected) => {
      vi.stubEnv('NODE_ENV', nodeEnv);
      const { isNodeEnvTest } = await loadVariables();
      expect(isNodeEnvTest()).toBe(expected);
    });
  });

  describe('flags', () => {
    const flags = [
      ['CI', 'isCi'],
      ['DEBUG', 'isDebug'],
      ['VITEST', 'isVitest'],
      ['TELEMETRY_DEBUG', 'isTelemetryDebug'],
    ] as const;
    const values = [
      ['true', true],
      ['TRUE', true],
      ['1', true],
      ['false', false],
      ['0', false],
      ['vite:*', false],
    ] as const;

    test.each(
      flags.flatMap(([key, check]) =>
        values.map(([value, expected]) => [key, value, check, expected] as const),
      ),
    )('%s=%s makes %s return %s', async (key, value, check, expected) => {
      vi.stubEnv(key, value);
      await expect(runCheck(check)).resolves.toBe(expected);
    });
  });

  describe('defaults', () => {
    test('URL and service getters fall back to their defaults when unset', async () => {
      for (const key of [
        'ADMIN_URL',
        'API_URL',
        'BACKEND_URL',
        'FARO_ENDPOINT',
        'FRONTEND_URL',
        'OTEL_SERVICE_NAME',
        'OTLP_ENDPOINT',
        'SERVICE_NAME',
        'SERVICE_VERSION',
        'SITE_URL',
      ]) {
        vi.stubEnv(key, undefined);
        vi.stubEnv(`VITE_${key}`, undefined);
      }
      const variables = await loadVariables();
      expect(variables.getAdminUrl()).toBe('http://localhost:3001');
      expect(variables.getApiBaseUrl()).toBe('http://localhost:3000');
      expect(variables.getBackendBaseUrl()).toBe('http://localhost:2000');
      expect(variables.getFaroEndpoint()).toBe('http://localhost:12347');
      expect(variables.getFrontendUrl()).toBe('http://localhost:2001');
      expect(variables.getOtelServiceName()).toBe('application');
      expect(variables.getOtlpEndpoint()).toBe('http://localhost:4318');
      expect(variables.getServiceName()).toBe('@lightproject/app');
      expect(variables.getServiceVersion()).toBe('1.0.0');
      expect(variables.getSiteUrl()).toBe('http://localhost:3002');
    });
  });
});
