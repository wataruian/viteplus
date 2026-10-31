import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

afterEach(() => {
  vi.resetModules();
});

describe('env', () => {
  test('loads with no app-specific keys declared yet', async () => {
    vi.resetModules();
    const { client, env, shared } = await import('../../src/env');
    expect(client).toStrictEqual({});
    expect(shared).toStrictEqual({});
    expect(env).toBeTypeOf('object');
  });
});
