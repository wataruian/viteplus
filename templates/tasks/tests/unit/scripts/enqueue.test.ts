import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import type { JobStore } from '../../../src/core/store';
import type * as stores from '../../../src/stores';
import { createMemoryStore } from '../../../src/stores/memory';

const originalArgv = globalThis.process.argv;

const runEnqueue = async (args: readonly string[], jobStore = 'database') => {
  vi.stubEnv('JOB_STORE', jobStore);
  globalThis.process.argv = ['node', 'enqueue.ts', ...args];
  const store = createMemoryStore();
  const close = vi.spyOn(store, 'close');
  const createJobStore = vi.fn(async (): Promise<JobStore> => {
    await Promise.resolve();
    return store;
  });
  vi.doMock('../../../src/stores', async (importOriginal) => ({
    ...(await importOriginal<typeof stores>()),
    createJobStore,
  }));
  const { logger } = await import('@lightproject/common/logger');
  const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
  const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
  await import('../../../src/scripts/enqueue');
  await vi.waitFor(() => {
    expect(info.mock.calls.length + error.mock.calls.length).toBe(1);
  });
  return { close, createJobStore, error, info, store };
};

afterEach(() => {
  globalThis.process.argv = originalArgv;
  globalThis.process.exitCode = undefined;
  vi.doUnmock('../../../src/stores');
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('enqueue script', () => {
  test('runs on import, enqueues count jobs of the named function and closes the store', async () => {
    const run = await runEnqueue(['ping', '{"message":"hello"}', '2']);

    expect(run.createJobStore).toHaveBeenCalledWith('database');
    expect(run.info).toHaveBeenCalledWith('Enqueued 2 ping job(s)', {
      ids: [expect.any(String), expect.any(String)],
    });
    expect(run.close).toHaveBeenCalledOnce();
    expect(globalThis.process.exitCode).toBeUndefined();
  });

  test('rejects an unknown function and exits 1', async () => {
    const run = await runEnqueue([]);

    expect(run.error).toHaveBeenCalledWith('Enqueue failed', {
      error: new Error('Unknown function "". Known: ping'),
    });
    expect(run.createJobStore).not.toHaveBeenCalled();
    expect(globalThis.process.exitCode).toBe(1);
  });

  test('refuses the memory store, which the workers process does not share', async () => {
    const run = await runEnqueue(['ping'], 'memory');

    expect(run.error).toHaveBeenCalledWith('Enqueue failed', {
      error: new Error('JOB_STORE=memory is not shared with the Node workers process'),
    });
    expect(run.createJobStore).not.toHaveBeenCalled();
    expect(globalThis.process.exitCode).toBe(1);
  });

  test('closes the store and exits 1 when the payload is invalid', async () => {
    const run = await runEnqueue(['ping', '{"message":1}']);

    expect(run.error).toHaveBeenCalledOnce();
    expect(run.close).toHaveBeenCalledOnce();
    expect(globalThis.process.exitCode).toBe(1);
  });
});
