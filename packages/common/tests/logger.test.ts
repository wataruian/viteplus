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

import type { LogLevel } from '../src/logger/formatters';
import { Logger, type LoggerOptions } from '../src/logger/log';
import { defaultRedactValue, redact } from '../src/logger/redactor';

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

  test('should format message with color based on sessionId and metadata with gray', async () => {
    const { requestContextStorage } = await import('../src/logger/context');
    const { getRandomColor, chalkInstance } = await import('../src/utils/color');
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
