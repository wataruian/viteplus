import { describe, expect, test, vi } from 'vite-plus/test';

vi.mock('node:fs', () => ({
  default: {
    existsSync: () => {
      throw new Error('boom');
    },
  },
}));

describe('pathExists when fs.existsSync throws', () => {
  test('returns false instead of propagating the error', async () => {
    const { pathExists } = await import('../src/node/directory');
    expect(pathExists('/anything')).toBe(false);
  });
});
