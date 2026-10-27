import { logger } from '@lightproject/common/logger';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { exitCodes, registerStop } from '../../../src/runtimes/node';

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

describe('registerStop', () => {
  test('the first signal aborts the script, a second exits at once', () => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const { exits, handlers } = capture();
    const controller = new globalThis.AbortController();
    registerStop(controller);

    expect([...handlers.keys()]).toStrictEqual(['SIGTERM', 'SIGINT', 'SIGHUP']);
    handlers.get('SIGTERM')?.();
    expect(controller.signal.aborted).toBe(true);
    expect(exits).toStrictEqual([]);

    expect(() => handlers.get('SIGINT')?.()).toThrow('process.exit');
    expect(exits).toStrictEqual([exitCodes.failed]);
  });
});
