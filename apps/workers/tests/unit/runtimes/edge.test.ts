import { describe, expect, test } from 'vite-plus/test';

describe('Worker entry (src/runtimes/edge.ts)', () => {
  test('exports only the handler and the Durable Object class', async () => {
    const entry = await import('../../../src/runtimes/edge');

    expect(Object.keys(entry).toSorted()).toStrictEqual(['WorkerLoop', 'default']);
  });
});
