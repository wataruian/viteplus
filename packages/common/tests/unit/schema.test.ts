import { createEnv } from '@t3-oss/env-core';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { z } from 'zod';

const loadSchema = async () => {
  vi.resetModules();
  return await import('../../src/environment/schema');
};

describe('environment schema', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('fails fast on an invalid value, naming the key but not the value', async () => {
    vi.stubEnv('LOG_LEVEL', 'loud-secret-value');
    await expect(loadSchema()).rejects.toThrow(/Invalid environment variables:\n- LOG_LEVEL: /u);
    await expect(loadSchema()).rejects.not.toThrow(/loud-secret-value/u);
  });

  test('lists every invalid key', async () => {
    vi.stubEnv('LOG_LEVEL', 'loud');
    vi.stubEnv('BACKEND_URL', 'not a url');
    await expect(loadSchema()).rejects.toThrow(
      /LOG_LEVEL[\s\S]*BACKEND_URL|BACKEND_URL[\s\S]*LOG_LEVEL/u,
    );
  });

  test('formats issues without a path and with object path segments', async () => {
    const { appEnvOptions } = await loadSchema();
    expect(() =>
      appEnvOptions.onValidationError([
        { message: 'no path' },
        { message: 'nested', path: [{ key: 'OUTER' }, 'INNER'] },
      ]),
    ).toThrow('Invalid environment variables:\n- (root): no path\n- OUTER.INNER: nested');
  });

  test('reads the VITE_ mirror when the plain variable is unset', async () => {
    vi.stubEnv('BACKEND_URL', undefined);
    vi.stubEnv('VITE_BACKEND_URL', 'http://from-vite.example');
    const { commonEnv } = await loadSchema();
    expect(commonEnv.BACKEND_URL).toBe('http://from-vite.example');
  });

  test('keeps shared keys readable in the browser', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {});
    vi.stubEnv('ENV', 'production');
    try {
      const { commonEnv } = await loadSchema();
      expect(commonEnv.ENV).toBe('production');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  describe('serverEnvOptions', () => {
    const server = { SECRET_TOKEN: z.string().optional() };

    test('validates server keys without a client section', async () => {
      vi.stubEnv('SECRET_TOKEN', 'token');
      const { serverEnvOptions, readRuntimeEnv } = await loadSchema();
      expect(serverEnvOptions).not.toHaveProperty('clientPrefix');
      const env = createEnv({
        ...serverEnvOptions,
        isServer: true,
        runtimeEnv: readRuntimeEnv(server),
        server,
      });
      expect(env.SECRET_TOKEN).toBe('token');
    });

    test('fails fast on an invalid server key', async () => {
      vi.stubEnv('PORT_NUMBER', 'abc');
      const { serverEnvOptions, readRuntimeEnv } = await loadSchema();
      const shape = { PORT_NUMBER: z.coerce.number().int() };
      expect(() =>
        createEnv({
          ...serverEnvOptions,
          isServer: true,
          runtimeEnv: readRuntimeEnv(shape),
          server: shape,
        }),
      ).toThrow(/Invalid environment variables:\n- PORT_NUMBER: /u);
    });
  });

  describe('appEnvOptions', () => {
    const client = { VITE_PUBLIC_KEY: z.string().optional() };
    const server = { SECRET_TOKEN: z.string().optional() };
    const shared = { PUBLIC_FLAG: z.string().optional() };

    test('validates client keys in the browser', async () => {
      vi.stubEnv('VITE_PUBLIC_KEY', 'public');
      const { appEnvOptions, readRuntimeEnv } = await loadSchema();
      const env = createEnv({
        ...appEnvOptions,
        client,
        isServer: false,
        runtimeEnv: readRuntimeEnv(client),
      });
      expect(env.VITE_PUBLIC_KEY).toBe('public');
    });

    test('blocks server keys on the client but allows shared keys', async () => {
      vi.stubEnv('PUBLIC_FLAG', 'on');
      const { appEnvOptions, readRuntimeEnv } = await loadSchema();
      const env = createEnv({
        ...appEnvOptions,
        client: {},
        isServer: false,
        runtimeEnv: readRuntimeEnv({ ...server, ...shared }),
        server,
        shared,
      });
      expect(env.PUBLIC_FLAG).toBe('on');
      expect(() => env.SECRET_TOKEN).toThrow(/server-side environment variable on the client/u);
    });
  });
});
