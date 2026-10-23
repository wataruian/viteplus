import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { registerShutdown } from '../../../src/runtimes/node';

afterEach(() => {
  vi.restoreAllMocks();
});

const capture = () => {
  const handlers = new Map<string, () => void>();
  vi.spyOn(globalThis.process, 'on').mockImplementation((event, handler) => {
    handlers.set(String(event), () => {
      handler(event);
    });
    return globalThis.process;
  });
  const exits: (string | number | null | undefined)[] = [];
  vi.spyOn(globalThis.process, 'exit').mockImplementation((code) => {
    exits.push(code);
    throw new Error('process.exit');
  });
  return { exits, handlers };
};

const neverStops = async () => {
  await new Promise<void>(() => {});
};

describe('registerShutdown', () => {
  test('a repeated shutdown request neither stops again nor exits early', () => {
    const { exits } = capture();
    const stop = vi.fn(neverStops);
    const shutdown = registerShutdown(stop);

    shutdown('Worker threads keep failing to start', 1);
    expect(() => {
      shutdown('Worker threads keep failing to start', 1);
    }).not.toThrow();

    expect(stop).toHaveBeenCalledOnce();
    expect(exits).toStrictEqual([]);
  });

  test('a second signal exits at once without waiting for jobs', () => {
    const { exits, handlers } = capture();
    registerShutdown(neverStops);

    handlers.get('SIGTERM')?.();
    expect(() => handlers.get('SIGTERM')?.()).toThrow('process.exit');

    expect(exits).toStrictEqual([1]);
  });
});
