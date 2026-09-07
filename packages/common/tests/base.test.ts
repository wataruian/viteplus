import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { checks, exit } from '../src/utils/base';

describe('checks', () => {
  test('reports valid when every property is falsy', () => {
    const result = checks([
      { message: 'should not fail', property: false },
      { message: 'should not fail either', property: () => false },
    ]);
    expect(result).toStrictEqual({ message: 'All checks passed', valid: true });
  });

  test('reports the first failing check and stops evaluating the rest', () => {
    const secondCheck = vi.fn(() => true);
    const result = checks([
      { message: 'first failure', property: true },
      { message: 'second failure', property: secondCheck },
    ]);

    expect(result).toStrictEqual({ message: 'first failure', valid: false });
    expect(secondCheck).not.toHaveBeenCalled();
  });

  test('defaults the message to "Check failed" when none is provided', () => {
    const result = checks([{ property: true }]);
    expect(result.message).toBe('Check failed');
  });

  test('throws the provided Error instead of returning when a check fails with one', () => {
    const error = new Error('boom');
    expect(() => {
      checks([{ error, property: true }]);
    }).toThrow(error);
  });
});

describe('exit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('logs the message and calls process.exit with the given code', () => {
    const exitSpy = vi.spyOn(globalThis.process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const logSpy = vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});

    expect(() => {
      exit({ code: 2, message: 'fatal error' });
    }).toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(2);
    logSpy.mockRestore();
  });

  test('defaults to exit code 1 and skips logging when no message is given', () => {
    const exitSpy = vi.spyOn(globalThis.process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const logSpy = vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});

    expect(() => {
      exit({});
    }).toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
