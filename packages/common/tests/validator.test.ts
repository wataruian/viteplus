import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { z } from 'zod';

import { commonEnvSchema, validateEnv } from '../src/environment/validator';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('commonEnvSchema', () => {
  test('ENV defaults to local when unset', () => {
    const { env } = validateEnv(commonEnvSchema);
    expect(env.ENV).toBe('local');
  });

  test('picks up known env vars', () => {
    vi.stubEnv('LOG_LEVEL', 'debug');
    vi.stubEnv('ENV', 'staging');
    const { env } = validateEnv(commonEnvSchema);
    expect(env.LOG_LEVEL).toBe('debug');
    expect(env.ENV).toBe('staging');
  });

  test('throws a descriptive error when a value violates the schema', () => {
    vi.stubEnv('LOG_LEVEL', 'not-a-level');
    expect(() => {
      validateEnv(commonEnvSchema);
    }).toThrow(/Invalid environment variables/u);
  });
});

describe('validateEnv().get', () => {
  test('prefers the live env value over the snapshot taken at validation time', () => {
    vi.stubEnv('ENV', 'staging');
    const { get } = validateEnv(commonEnvSchema);
    expect(get('ENV')).toBe('staging');

    vi.stubEnv('ENV', 'production');
    expect(get('ENV')).toBe('production');
  });

  test('falls back to the validated snapshot when the live value is unset', () => {
    vi.stubEnv('ENV', 'staging');
    const { get } = validateEnv(commonEnvSchema);
    vi.stubEnv('ENV', undefined);
    expect(get('ENV')).toBe('staging');
  });

  test('returns undefined when neither the live value nor the snapshot has a string', () => {
    const { get } = validateEnv(commonEnvSchema);
    expect(get('CI')).toBeUndefined();
  });
});

describe('validateEnv with a non-ZodObject schema', () => {
  test('collects no env vars (only ZodObject schemas are introspected) and validates an empty object', () => {
    expect(() => {
      validateEnv(z.string());
    }).toThrow();
  });
});
