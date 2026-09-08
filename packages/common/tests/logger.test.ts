import { AsyncLocalStorage } from 'node:async_hooks';

import { type Context, type ContextManager, ROOT_CONTEXT, context } from '@opentelemetry/api';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vite-plus/test';

import {
  getColor,
  getRequestContext,
  getSessionId,
  isRequestContext,
  requestContextStorage,
} from '../src/logger/context';
import { type LogEntry, type LogLevel, formatJSON, formatPretty } from '../src/logger/formatters';
import { Logger, type LoggerOptions, isFaroLogLevel } from '../src/logger/log';
import { defaultRedactValue, getRedactFn, redact } from '../src/logger/redactor';
import { chalkInstance, defaultColor, getRandomColor } from '../src/utils/color';

const createAsyncHooksContextManager = (): ContextManager => {
  const storage = new AsyncLocalStorage<Context>();

  const manager: ContextManager = {
    active: () => storage.getStore() ?? ROOT_CONTEXT,
    bind: (_activeContext, target) => target,
    disable: () => manager,
    enable: () => manager,
    with: (activeContext, fn, thisArg, ...args) =>
      storage.run(activeContext, () => fn.call(thisArg, ...args)),
  };

  return manager;
};

const customRedactValue = '[SENSITIVE]';
const callableRedactStub = () => 'called';

const getLastConsoleLog = (): string => {
  const { calls } = vi.mocked(globalThis.console.log).mock;
  return typeof calls[0]?.[0] === 'string' ? calls[0][0] : '';
};

const testLoggerCall = ({
  level,
  message,
  metadata,
  options = {},
}: {
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  options?: Partial<LoggerOptions>;
}) => {
  const logger = new Logger({ silent: false, ...options });
  logger[level](message, metadata);
  return getLastConsoleLog();
};

describe('Logger Redaction', () => {
  test.each([
    {
      expected: { password: defaultRedactValue, safe: 'somesafedata', secret: defaultRedactValue },
      fields: undefined,
      metadata: { password: 'somepassword', safe: 'somesafedata', secret: 'somesecret' },
      redactValue: undefined,
      title: 'should mask default fields using default redact value correctly',
    },
    {
      expected: { password: customRedactValue, safe: 'somesafedata', secret: customRedactValue },
      fields: undefined,
      metadata: { password: 'somepassword', safe: 'somesafedata', secret: 'somesecret' },
      redactValue: customRedactValue,
      title: 'should mask default fields using custom redact value correctly',
    },
    {
      expected: { safe: 'somesafedata', secret: defaultRedactValue, somekey: defaultRedactValue },
      fields: ['somekey'],
      metadata: { safe: 'somesafedata', secret: 'somesecret', somekey: 'somesensitivedata' },
      redactValue: undefined,
      title: 'should mask custom fields using default redact value correctly',
    },
    {
      expected: { safe: 'somesafedata', secret: customRedactValue, somekey: customRedactValue },
      fields: ['somekey'],
      metadata: { safe: 'somesafedata', secret: 'somesecret', somekey: 'somesensitivedata' },
      redactValue: customRedactValue,
      title: 'should mask custom fields using custom redact value correctly',
    },
  ])('$title', ({ expected, fields, metadata, redactValue }) => {
    expect(redact(metadata, fields, redactValue)).toMatchObject(expected);
  });

  test('should not mutate original object', () => {
    const original = { apiKey: 'someapikey', user: { name: 'John', password: 'somepassword' } };
    const originalCopy = globalThis.structuredClone(original);
    const redacted = redact(original);

    expect(redacted).toMatchObject({
      apiKey: defaultRedactValue,
      user: { name: 'John', password: defaultRedactValue },
    });
    expect(original).toEqual(originalCopy);
  });

  test('should redact deeply nested fields', () => {
    const metadata = { level1: { level2: { password: 'somepassword', safe: 'somesafedata' } } };
    expect(redact(metadata)).toMatchObject({
      level1: { level2: { password: defaultRedactValue, safe: 'somesafedata' } },
    });
  });

  test('should pass primitives through unchanged without attempting to redact them', () => {
    expect(redact(null)).toBeNull();
    expect(redact('a string')).toBe('a string');
    expect(redact(42)).toBe(42);
    expect(redact(undefined)).toBeUndefined();
  });

  test('should fall back to a shallow copy (and still redact) when structuredClone cannot clone the value', () => {
    const marker = Symbol('unclonable');
    const original = { marker, password: 'somepassword' };
    const result = redact(original);

    if (
      typeof result !== 'object' ||
      result === null ||
      !('password' in result) ||
      !('marker' in result)
    ) {
      throw new Error('expected redact() to return an object with password and marker fields');
    }
    expect(result.password).toBe(defaultRedactValue);
    expect(result.marker).toBe(marker);
  });

  test('should return the original data unchanged if the redact implementation cannot process it', () => {
    const original = { fn: () => 'unclonable', password: 'somepassword' };
    expect(redact(original)).toBe(original);
  });

  test('should fall back to a shallow copy for a non-record (array) value that cannot be structuredClone-d', () => {
    const original = [Symbol('unclonable'), 'password'];
    expect(() => redact(original)).not.toThrow();
  });

  test('should return the data unchanged when no usable redact implementation is available', async () => {
    vi.resetModules();
    vi.doMock('redact-object', () => ({ default: 'not-a-function' }));

    const { redact: redactWithoutImpl } = await import('../src/logger/redactor');
    const original = { password: 'somepassword' };

    expect(redactWithoutImpl(original)).toBe(original);

    vi.doUnmock('redact-object');
    vi.resetModules();
  });

  describe('getRedactFn', () => {
    test('returns the module itself when it is directly callable', () => {
      expect(getRedactFn(callableRedactStub)).toBe(callableRedactStub);
    });

    test('returns the default export when the module is a record with a callable default', () => {
      expect(getRedactFn({ default: callableRedactStub })).toBe(callableRedactStub);
    });

    test('returns null when the module is a record without a callable default', () => {
      expect(getRedactFn({ default: 'not-callable' })).toBeNull();
      expect(getRedactFn({})).toBeNull();
    });

    test('returns null when the module is neither callable nor a record', () => {
      expect(getRedactFn('a string')).toBeNull();
      expect(getRedactFn(42)).toBeNull();
      expect(getRedactFn(null)).toBeNull();
      expect(getRedactFn([1, 2, 3])).toBeNull();
    });
  });

  test('should return the original data if the redact implementation itself throws', async () => {
    vi.resetModules();
    vi.doMock('redact-object', () => ({
      default: () => {
        throw new Error('redact-object blew up');
      },
    }));

    const { redact: redactWithBrokenImpl } = await import('../src/logger/redactor');
    const original = { password: 'somepassword' };

    expect(redactWithBrokenImpl(original)).toBe(original);

    vi.doUnmock('redact-object');
    vi.resetModules();
  });
});

describe('Logger Format', () => {
  beforeEach(() => {
    vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
    vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test.each([
    { env: 'local', expected: 'pretty', title: 'should default to pretty in local' },
    {
      env: 'local',
      expected: 'json',
      logFormat: 'json',
      title: 'should respect LOG_FORMAT=json in local',
    },
    {
      env: 'local',
      expected: 'pretty',
      logFormat: 'json',
      optionsMode: 'pretty',
      title: 'should prioritize options.mode in local',
    },
    { env: 'test', expected: 'json', title: 'should force json in non-local' },
    {
      env: 'test',
      expected: 'json',
      optionsMode: 'pretty',
      title: 'should force json in non-local even if pretty requested',
    },
    {
      env: 'test',
      expected: 'json',
      logFormat: 'pretty',
      title: 'should force json in non-local regardless of LOG_FORMAT',
    },
  ] as const)('$title', ({ env, expected, logFormat, optionsMode }) => {
    vi.stubEnv('ENV', env);
    if (logFormat) {
      vi.stubEnv('LOG_FORMAT', logFormat);
    }
    const logger = new Logger(optionsMode ? { mode: optionsMode } : {});
    expect(logger.mode).toBe(expected);
  });
});

describe('Logger Integration - Redaction Output', () => {
  beforeEach(() => {
    vi.stubEnv('ENV', 'local');
    vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
    vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const testCases = [
    {
      expected: { password: defaultRedactValue, safe: 'somesafedata', secret: defaultRedactValue },
      metadata: { password: 'somepassword', safe: 'somesafedata', secret: 'somesecret' },
      title: 'should mask default fields',
    },
    {
      expected: { safe: 'somesafedata', secret: defaultRedactValue, somekey: defaultRedactValue },
      metadata: { safe: 'somesafedata', secret: 'somesecret', somekey: 'somesensitivedata' },
      options: { redact: ['somekey'] },
      title: 'should mask custom fields',
    },
    {
      expected: {
        apiKey: defaultRedactValue,
        user: { name: 'John', password: defaultRedactValue },
      },
      metadata: { apiKey: 'someapikey', user: { name: 'John', password: 'somepassword' } },
      title: 'should redact deeply nested user info',
    },
  ];

  test.each(testCases)('$title (JSON mode)', ({ expected, metadata, options }) => {
    const output = testLoggerCall({
      level: 'info',
      message: 'test',
      metadata,
      options: { ...options, mode: 'json' },
    });

    expect(JSON.parse(output)).toMatchObject({ context: expected });
  });

  test.each(testCases)('$title (Pretty mode)', ({ expected: _expected, metadata, options }) => {
    const output = testLoggerCall({
      level: 'info',
      message: 'test',
      metadata,
      options: { ...options, mode: 'pretty' },
    });

    expect(output).toContain(defaultRedactValue);
    if (metadata.user) {
      expect(output).toContain('John');
    }
    expect(output).toContain(defaultRedactValue);
  });

  test('should not mutate original object during logging', () => {
    const metadata = { apiKey: 'someapikey', user: { name: 'John', password: 'somepassword' } };
    const original = globalThis.structuredClone(metadata);

    testLoggerCall({ level: 'info', message: 'test', metadata });

    expect(metadata).toEqual(original);
  });
});

describe('Logger Integration - Session ID Color', () => {
  beforeAll(() => {
    context.disable();
    context.setGlobalContextManager(createAsyncHooksContextManager().enable());
  });

  afterAll(() => {
    context.disable();
  });

  beforeEach(() => {
    vi.stubEnv('ENV', 'local');
    vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test('should format message with color based on sessionId and metadata with gray', () => {
    const sessionId = 'test-session-id';
    const color = getRandomColor(sessionId);

    let output = '';
    requestContextStorage.run({ color, sessionId }, () => {
      output = testLoggerCall({
        level: 'info',
        message: 'hello from session',
        metadata: { foo: 'bar' },
        options: { color: true, mode: 'pretty' },
      });
    });

    const expectedColoredMessage = color('hello from session');
    expect(output).toContain(expectedColoredMessage);

    const expectedMetadataStr = JSON.stringify({ foo: 'bar', sessionId }, undefined, 5);
    const expectedColoredMetadata = chalkInstance.gray(expectedMetadataStr);
    expect(output).toContain(expectedColoredMetadata);
  });
});

describe('isFaroLogLevel', () => {
  test('returns true for any string value', () => {
    expect(isFaroLogLevel('info')).toBe(true);
    expect(isFaroLogLevel('anything')).toBe(true);
  });

  test('returns false for non-string values', () => {
    expect(isFaroLogLevel(42)).toBe(false);
    expect(isFaroLogLevel(undefined)).toBe(false);
    expect(isFaroLogLevel(null)).toBe(false);
  });
});

describe('Logger Context - no active request context', () => {
  test('getSessionId returns "no-id"', () => {
    expect(getSessionId()).toBe('no-id');
  });

  test('getRequestContext returns undefined', () => {
    expect(getRequestContext()).toBeUndefined();
  });

  test('getColor returns the default color', () => {
    expect(getColor()).toBe(defaultColor);
  });

  test.each([{ label: 'a valid request context', value: { sessionId: 'abc' } }])(
    'isRequestContext recognizes $label',
    ({ value }) => {
      expect(isRequestContext(value)).toBe(true);
    },
  );

  test.each([
    { label: 'null', value: null },
    { label: 'a string', value: 'not-an-object' },
    { label: 'a number', value: 42 },
    { label: 'an object without sessionId', value: { other: 'field' } },
  ])('isRequestContext rejects $label', ({ value }) => {
    expect(isRequestContext(value)).toBe(false);
  });
});

describe('Logger Context and Formatters - with an active request context', () => {
  beforeAll(() => {
    context.disable();
    context.setGlobalContextManager(createAsyncHooksContextManager().enable());
  });

  afterAll(() => {
    context.disable();
  });

  test('getSessionId and getRequestContext reflect the active store', () => {
    requestContextStorage.run({ sessionId: 'store-session' }, () => {
      expect(getSessionId()).toBe('store-session');
      expect(getRequestContext()).toStrictEqual({ sessionId: 'store-session' });
    });
  });

  test('getColor returns the store color when one is explicitly set', () => {
    const explicitColor = getRandomColor('explicit-color-id');
    requestContextStorage.run({ color: explicitColor, sessionId: 'store-session' }, () => {
      expect(getColor()).toBe(explicitColor);
    });
  });

  test('getColor falls back to a random color derived from the store sessionId', () => {
    requestContextStorage.run({ sessionId: 'derived-color-id' }, () => {
      expect(getColor()).toBe(getRandomColor('derived-color-id'));
    });
  });

  test('formatPretty colorizes using the active store when the entry has no context', () => {
    requestContextStorage.run({ sessionId: 'format-store-id' }, () => {
      const entry: LogEntry = { level: 'info', message: 'hello', timestamp: '2024-01-01' };
      const output = formatPretty(entry, true);
      const expectedColor = getRandomColor('format-store-id');
      expect(output).toContain(expectedColor('hello'));
    });
  });
});

describe('Logger Formatters - direct unit tests', () => {
  test('formatJSON serializes the entry as-is', () => {
    const entry: LogEntry = { level: 'error', message: 'boom', timestamp: '2024-01-01' };
    expect(formatJSON(entry)).toBe(JSON.stringify(entry));
  });

  test('formatPretty without color renders plain text and a raw (uncolored) context block', () => {
    const entry: LogEntry = {
      context: { a: 1 },
      level: 'warn',
      message: 'careful',
      timestamp: '2024-01-01',
    };
    const output = formatPretty(entry, false);
    expect(output).toBe(
      `[2024-01-01] WARN : careful\n${JSON.stringify(entry.context, undefined, 5)}`,
    );
  });

  test('formatPretty omits the context block when context is undefined', () => {
    const entry: LogEntry = { level: 'debug', message: 'no context here', timestamp: '2024-01-01' };
    expect(formatPretty(entry, false)).toBe('[2024-01-01] DEBUG: no context here');
  });

  test('formatPretty omits the context block when context is an empty object', () => {
    const entry: LogEntry = {
      context: {},
      level: 'debug',
      message: 'empty context',
      timestamp: '2024-01-01',
    };
    expect(formatPretty(entry, false)).toBe('[2024-01-01] DEBUG: empty context');
  });

  test('formatPretty with color uses an explicit context.sessionId regardless of any active store', () => {
    const entry: LogEntry = {
      context: { sessionId: 'explicit-in-context' },
      level: 'info',
      message: 'explicit session',
      timestamp: '2024-01-01',
    };
    const output = formatPretty(entry, true);
    expect(output).toContain(getRandomColor('explicit-in-context')('explicit session'));
  });

  test('formatPretty with color leaves the message uncolored when there is no session and no active store', () => {
    const entry: LogEntry = {
      context: { foo: 'bar' },
      level: 'info',
      message: 'plain message',
      timestamp: '2024-01-01',
    };
    const output = formatPretty(entry, true);
    expect(output).toContain(': plain message');
  });
});

describe('Logger - level handling and output branches', () => {
  beforeEach(() => {
    vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test.each(['debug', 'warn', 'error'] as const)(
    '%s produces console output when allowed by the configured level',
    (level) => {
      const output = testLoggerCall({
        level,
        message: `${level} message`,
        options: { level: 'debug', mode: 'json' },
      });
      expect(JSON.parse(output)).toMatchObject({ level, message: `${level} message` });
    },
  );

  test('messages below the configured level are filtered out', () => {
    const logger = new Logger({ level: 'warn', mode: 'json', silent: false });
    const logSpy = vi.mocked(globalThis.console.log);

    logger.debug('should not appear');
    logger.info('should not appear either');
    expect(logSpy).not.toHaveBeenCalled();

    logger.warn('should appear');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  test('derives the default level from LOG_LEVEL when no explicit level option is given', () => {
    vi.stubEnv('LOG_LEVEL', 'error');
    const logger = new Logger({ mode: 'json', silent: false });
    const logSpy = vi.mocked(globalThis.console.log);

    logger.warn('filtered out by env-derived level');
    expect(logSpy).not.toHaveBeenCalled();

    logger.error('allowed through');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  test('omits the timestamp field when the timestamp option is false', () => {
    const output = testLoggerCall({
      level: 'info',
      message: 'no ts',
      options: { mode: 'json', timestamp: false },
    });
    expect(JSON.parse(output)).toMatchObject({ timestamp: '' });
  });

  test('omits the context field entirely when there is no metadata and no active request context', () => {
    const output = testLoggerCall({
      level: 'info',
      message: 'no metadata',
      options: { mode: 'json' },
    });
    expect(JSON.parse(output)).not.toHaveProperty('context');
  });

  test('does not throw when writing to OTel/Faro outputs while isBrowser() is true', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {});

    expect(() => {
      testLoggerCall({
        level: 'info',
        message: 'browser path',
        metadata: { a: 1 },
        options: { mode: 'json' },
      });
    }).not.toThrow();
  });
});
