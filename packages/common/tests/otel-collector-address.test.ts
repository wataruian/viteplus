import { describe, expect, test, vi } from 'vite-plus/test';

vi.mock('@hono/node-server', () => ({
  serve: (_options: unknown, callback: () => void) => {
    globalThis.queueMicrotask(callback);
    return {
      address: () => null,
      close: (cb: () => void) => {
        cb();
      },
    };
  },
}));

describe('startFakeOtelCollector when the server address cannot be determined', () => {
  test('throws', async () => {
    vi.resetModules();
    const { startFakeOtelCollector } = await import('../src/testing/otel-collector');
    await expect(startFakeOtelCollector()).rejects.toThrow(
      'Failed to determine the fake OTEL collector address',
    );
  });
});
