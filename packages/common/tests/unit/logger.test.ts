import { AsyncLocalStorage } from 'node:async_hooks';

import {
  type Context,
  type ContextManager,
  ROOT_CONTEXT,
  TraceFlags,
  context,
  trace,
} from '@opentelemetry/api';
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

import { type BrowserLogSink, registerBrowserLogSink } from '../../src/logger/browser-sink';
import {
  getClientId,
  getColor,
  getRequestContext,
  getRequestId,
  getTraceContext,
  isRequestContext,
  requestContextStorage,
  runWithRequestContext,
  setClientId,
  setRequestId,
  startRequestScope,
  startSpanWithRequestId,
} from '../../src/logger/context';
import {
  type LogEntry,
  type LogLevel,
  formatJSON,
  formatPretty,
} from '../../src/logger/formatters';
import { Logger, type LoggerOptions } from '../../src/logger/log';
import {
  defaultRedactValue,
  getRedactFn,
  redact,
  redactUrl,
  serializeForLog,
} from '../../src/logger/redactor';
import { chalkInstance, defaultColor, getRandomColor } from '../../src/utils/color';
import { tracer } from '../../src/utils/telemetry';

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

const createFakeSink = () => {
  const sink = {
    pushLog: vi.fn<BrowserLogSink['pushLog']>(),
  } satisfies BrowserLogSink;
  return sink;
};

const customRedactValue = '[SENSITIVE]';
const callableRedactStub = () => 'called';

const validSpanContext = {
  spanId: 'b7ad6b7169203331',
  traceFlags: TraceFlags.SAMPLED,
  traceId: '0af7651916cd43dd8448eb211c80319c',
};

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

describe('serializeForLog', () => {
  beforeEach(() => {
    vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('turns Errors (and their causes) into plain objects that survive JSON', () => {
    const cause = new Error('db down');
    const error = Object.assign(new Error('query failed', { cause }), { code: 'E_QUERY' });

    const json = JSON.stringify(serializeForLog({ err: error }));

    expect(json).toContain('"message":"query failed"');
    expect(json).toContain('"code":"E_QUERY"');
    expect(json).toContain('"stack":"Error: query failed');
    expect(json).toContain('"cause":{"message":"db down","name":"Error"');
  });

  test('recurses into arrays and plain objects; Dates use toJSON, Maps keep their entries', () => {
    const serialized = serializeForLog({
      list: [new TypeError('bad')],
      nested: { at: new Date(0), map: new Map([['password', 'p']]) },
    });

    expect(serialized).toStrictEqual({
      list: [expect.objectContaining({ message: 'bad', name: 'TypeError' })],
      nested: { at: '1970-01-01T00:00:00.000Z', map: { password: 'p' } },
    });
  });

  test('omits stack when an Error has none', () => {
    const error = new Error('stackless');
    Object.defineProperty(error, 'stack', { value: undefined });

    expect(serializeForLog(error)).toStrictEqual({ message: 'stackless', name: 'Error' });
  });

  test('serializes an own enumerable `cause` (as tRPC sets it) once, in full', () => {
    const cause = new Error('db down');
    const error = new Error('wrapped');
    Object.defineProperty(error, 'cause', { enumerable: true, value: cause });

    expect(serializeForLog(error)).toMatchObject({
      cause: { message: 'db down', name: 'Error' },
      message: 'wrapped',
    });
  });

  test('keeps shared (non-circular) references instead of marking them circular', () => {
    const tags = ['a', 'b'];
    const inner = new Error('inner');

    const serialized = serializeForLog({
      a: tags,
      b: tags,
      err: new Error('outer', { cause: inner }),
      root: inner,
    });

    expect(serialized).toMatchObject({
      a: ['a', 'b'],
      b: ['a', 'b'],
      err: { cause: { message: 'inner' } },
      root: { message: 'inner' },
    });
  });

  test('includes the nested errors of an AggregateError', () => {
    const serialized = serializeForLog(
      new AggregateError([new Error('e1'), new Error('e2')], 'many'),
    );

    expect(serialized).toMatchObject({
      errors: [{ message: 'e1' }, { message: 'e2' }],
      message: 'many',
      name: 'AggregateError',
    });
  });

  test('honours an Error subclass toJSON (e.g. to hide PII) instead of dumping its fields', () => {
    class AppError extends Error {
      public override readonly name = 'AppError';
      public readonly user = { email: 'a@b.c', ssn: '123' };

      public toJSON() {
        return { code: 'E_APP', message: this.message };
      }
    }

    expect(serializeForLog(new AppError('nope'))).toStrictEqual({ code: 'E_APP', message: 'nope' });
  });

  test('keeps an own enumerable `errors` field on non-Aggregate errors (validation details)', () => {
    class ValidationError extends Error {
      public override readonly name = 'ValidationError';
      public readonly errors = [{ field: 'email', message: 'required' }];
    }

    expect(serializeForLog(new ValidationError('invalid'))).toMatchObject({
      errors: [{ field: 'email', message: 'required' }],
      message: 'invalid',
    });
  });

  test('recognises errors from another realm (no instanceof Error)', () => {
    const foreignBase: object = {};
    Object.setPrototypeOf(foreignBase, null);
    const foreign = Object.defineProperties(foreignBase, {
      [Symbol.toStringTag]: { value: 'Error' },
      message: { value: 'foreign boom' },
      name: { value: 'Error' },
      stack: { value: 'Error: foreign boom' },
    });

    expect(serializeForLog(foreign)).toStrictEqual({
      message: 'foreign boom',
      name: 'Error',
      stack: 'Error: foreign boom',
    });
  });

  test('defaults message/name for errors without string fields', () => {
    const oddBase: object = {};
    Object.setPrototypeOf(oddBase, null);
    const odd = Object.defineProperties(oddBase, {
      [Symbol.toStringTag]: { value: 'Error' },
    });

    expect(serializeForLog(odd)).toStrictEqual({ message: '', name: 'Error' });
  });

  test('omits a value whose toJSON returns undefined, as JSON does', () => {
    expect(serializeForLog({ hidden: { toJSON: () => undefined }, shown: 1 })).toStrictEqual({
      shown: 1,
    });
  });

  test('keeps entries of Set, Headers and URLSearchParams', () => {
    expect(
      serializeForLog({
        headers: new globalThis.Headers({ 'x-trace': 't' }),
        query: new globalThis.URLSearchParams('page=2'),
        set: new Set([1, 2]),
      }),
    ).toStrictEqual({ headers: { 'x-trace': 't' }, query: { page: '2' }, set: [1, 2] });
  });

  test('mirrors JSON for primitives: bigint → string, non-finite → null, undefined omitted', () => {
    expect(
      serializeForLog({
        big: 10n,
        gone: undefined,
        inf: Number.POSITIVE_INFINITY,
        nan: Number.NaN,
      }),
    ).toStrictEqual({ big: '10', inf: null, nan: null });
    expect(serializeForLog([undefined, 1])).toStrictEqual([null, 1]);
    expect(serializeForLog(Symbol('top'))).toBeUndefined();
  });

  test('redacts credentials and sensitive query values in URL objects', () => {
    expect(
      serializeForLog(new globalThis.URL('https://u:pw@x.test/cb?access_token=abc&page=2')),
    ).toBe('https://REDACTED:REDACTED@x.test/cb?access_token=REDACTED&page=2');
  });

  test('serializes the fields of an object whose toJSON returns itself', () => {
    const value = {
      toJSON() {
        return this;
      },
      v: 1,
    };

    expect(serializeForLog({ a: value })).toStrictEqual({ a: { v: 1 } });
  });

  test('keeps every Map entry: object keys by position (never their content), collisions suffixed', () => {
    expect(
      serializeForLog(
        new Map<unknown, string>([
          [{ a: 1 }, 'x'],
          [{ b: 2 }, 'y'],
          [1, 'number'],
          ['1', 'string'],
          [Symbol('s'), 'symbol'],
        ]),
      ),
    ).toStrictEqual({
      1: 'number',
      '1 (2)': 'string',
      'Symbol(s)': 'symbol',
      '[key 1]': 'x',
      '[key 2]': 'y',
    });
  });

  test('a `__proto__` key cannot switch off redaction (top level, nested, or as a Map key)', () => {
    const body: unknown = JSON.parse(
      '{"__proto__":{"x":1},"password":"hunter2","nested":{"token":"t0k"}}',
    );

    const json = JSON.stringify(
      redact({ body, map: new Map<string, unknown>([['__proto__', { password: 'p2' }]]) }),
    );

    expect(json).not.toContain('hunter2');
    expect(json).not.toContain('t0k');
    expect(json).not.toContain('p2');
    expect(json).toContain('"[__proto__]":{"x":1}');
  });

  test('custom redact fields also apply inside URL values', () => {
    expect(
      redact({ link: new globalThis.URL('https://h/cb?sessionKey=abc&page=2') }, ['sessionKey']),
    ).toStrictEqual({
      link: 'https://h/cb?sessionKey=REDACTED&page=2',
    });
  });

  test('never logs secrets held inside object Map keys', () => {
    const json = JSON.stringify(redact({ m: new Map([[{ password: 'hunter2' }, 1]]) }));

    expect(json).not.toContain('hunter2');
    expect(json).toContain('[key 1]');
  });

  test('cuts off very deep nesting instead of overflowing the stack', () => {
    let deep: Record<string, unknown> = { leaf: true };
    for (let level = 0; level < 20_000; level += 1) {
      deep = { next: deep };
    }

    expect(JSON.stringify(serializeForLog(deep))).toContain('"[Max Depth]"');
  });

  test('replaces circular references instead of recursing forever', () => {
    const circular: Record<string, unknown> = { name: 'loop' };
    circular['self'] = circular;
    const error = new Error('cyclic');
    Object.assign(error, { self: error });

    expect(serializeForLog(circular)).toStrictEqual({ name: 'loop', self: '[Circular]' });
    expect(serializeForLog(error)).toMatchObject({ message: 'cyclic', self: '[Circular]' });
  });

  test('logs an Error passed as metadata with its message and stack (not `{}`)', () => {
    const output = testLoggerCall({
      level: 'error',
      message: 'failed',
      metadata: { err: new Error('boom') },
      options: { mode: 'json' },
    });

    expect(output).toContain('"err":{"message":"boom","name":"Error","stack":"Error: boom');
  });
});

describe('redactUrl', () => {
  test('masks sensitive query values (case-insensitively), leaving every other byte as-is', () => {
    expect(redactUrl('https://x.test/cb?q=a%20b&flag&Access_Token=abc&page=2')).toBe(
      'https://x.test/cb?q=a%20b&flag&Access_Token=REDACTED&page=2',
    );
  });

  test('masks userinfo credentials (with or without a password, incl. protocol-relative URLs)', () => {
    expect(redactUrl('https://user:pass@x.test/')).toBe('https://REDACTED:REDACTED@x.test/');
    expect(redactUrl('//user:pass@x.test/a')).toBe('//REDACTED:REDACTED@x.test/a');
    expect(redactUrl('https://user:p@ss@host/x')).toBe('https://REDACTED:REDACTED@host/x');
    expect(redactUrl('https://x.test/users/me@example')).toBe('https://x.test/users/me@example');
    expect(redactUrl('https://apikey@x.test/a')).toBe('https://REDACTED@x.test/a');
  });

  test('redacts relative URLs too', () => {
    expect(redactUrl('/cb?token=abc&page=2')).toBe('/cb?token=REDACTED&page=2');
  });

  test('redacts sensitive params in the fragment (e.g. OAuth implicit flow)', () => {
    expect(redactUrl('https://x.test/a?x=1#access_token=abc&state=s')).toBe(
      'https://x.test/a?x=1#access_token=REDACTED&state=s',
    );
    expect(redactUrl('https://x.test/a#section-2')).toBe('https://x.test/a#section-2');
  });

  test("redacts sensitive keys inside a JSON-valued param (tRPC's `input`)", () => {
    const input = encodeURIComponent(
      JSON.stringify({ 0: { json: { password: 'hunter2', token: 'abc', user: 'al' } } }),
    );

    const redacted = redactUrl(`http://localhost:2000/trpc/auth.login?batch=1&input=${input}`);

    expect(decodeURIComponent(redacted)).toBe(
      'http://localhost:2000/trpc/auth.login?batch=1&input={"0":{"json":{"password":"REDACTED","token":"REDACTED","user":"al"}}}',
    );
  });

  test.each([
    { label: 'leading whitespace', raw: '%20%7B%22password%22%3A%22hunter2%22%7D' },
    { label: 'a leading newline', raw: '%0A%7B%22password%22%3A%22hunter2%22%7D' },
    { label: 'a stray %', raw: '%7B%22password%22%3A%22hunter2%22%2C%22p%22%3A%22100%%22%7D' },
    { label: 'unencoded JSON', raw: '{"password":"hunter2"}' },
    { label: '+ as space', raw: '%7B%22password%22%3A+%22hunter2%22%7D' },
  ])('redacts JSON params the way the server decodes them ($label)', ({ raw }) => {
    expect(redactUrl(`/trpc/x?input=${raw}`)).not.toContain('hunter2');
  });

  test('never throws on extremely deep JSON params (fails closed instead)', () => {
    const deep = `${'['.repeat(20_000)}${']'.repeat(20_000)}`;

    expect(() => redactUrl(`/trpc/x?input=${encodeURIComponent(deep)}`)).not.toThrow();
  });

  test('leaves non-sensitive JSON params, non-JSON values and bad encodings untouched', () => {
    const input = encodeURIComponent(JSON.stringify({ 0: { json: { user: 'al' } } }));
    const urls = [
      `http://localhost/trpc/a?batch=1&input=${input}`,
      'https://x.test/a?data=%7Bnot-json&page=2',
      'https://x.test/a?q=%E0%A4%A&page=2',
      'https://x.test/a?page=2',
    ];

    for (const url of urls) {
      expect(redactUrl(url)).toBe(url);
    }
  });
});

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

  test('drops values JSON cannot represent (symbols) and still redacts', () => {
    expect(redact({ marker: Symbol('unclonable'), password: 'somepassword' })).toStrictEqual({
      password: defaultRedactValue,
    });
  });

  test('still redacts when the metadata holds non-plain values (Date, URL, functions are dropped)', () => {
    const fn = Math.max;

    expect(
      redact({
        at: new Date(0),
        fn,
        password: 'somepassword',
        url: new globalThis.URL('https://example.test/a'),
      }),
    ).toStrictEqual({
      at: '1970-01-01T00:00:00.000Z',
      password: defaultRedactValue,
      url: 'https://example.test/a',
    });
  });

  test('redacts secrets held by class instances (logged via their own enumerable fields)', () => {
    class Credentials {
      public readonly password = 'somepassword';
      public readonly user = 'alice';
    }

    expect(redact({ credentials: new Credentials() })).toStrictEqual({
      credentials: { password: defaultRedactValue, user: 'alice' },
    });
  });

  test('matches field names case-insensitively (e.g. an Authorization header)', () => {
    expect(
      redact({ headers: { Accept: 'json', Authorization: 'Bearer x', 'X-Api-Key': 'k' } }),
    ).toStrictEqual({
      headers: {
        Accept: 'json',
        Authorization: defaultRedactValue,
        'X-Api-Key': defaultRedactValue,
      },
    });
  });

  test('serializes array entries JSON cannot represent as null, and still redacts', () => {
    expect(redact([Symbol('unclonable'), { token: 't' }])).toStrictEqual([
      null,
      { token: defaultRedactValue },
    ]);
  });

  test.each([
    {
      label: 'a throwing getter',
      value: {
        get lazy(): string {
          throw new Error('lazy getter blew up');
        },
      },
    },
    {
      label: 'a throwing toJSON',
      value: {
        toJSON() {
          throw new Error('toJSON blew up');
        },
      },
    },
    {
      label: 'a revoked proxy',
      value: (() => {
        const { proxy, revoke } = Proxy.revocable({}, {});
        revoke();
        return proxy;
      })(),
    },
  ])('fails closed (no throw, no raw data) on $label', ({ value }) => {
    expect(redact({ password: 'somepassword', value })).toStrictEqual({
      metadata: '[REDACTION FAILED]',
    });
  });

  test('the logger never throws on unserializable metadata, and shows the failure', () => {
    const logSpy = vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
    const output = testLoggerCall({
      level: 'error',
      message: 'Internal Server Error',
      metadata: {
        err: {
          get detail(): string {
            throw new Error('lazy getter blew up');
          },
        },
      },
      options: { mode: 'json' },
    });

    expect(output).toContain('"metadata":"[REDACTION FAILED]"');
    logSpy.mockRestore();
  });

  test('fails closed (no raw data) when no usable redact implementation is available', async () => {
    vi.resetModules();
    vi.doMock('redact-object', () => ({ default: 'not-a-function' }));

    const { failedRedactionValue: failed, redact: redactWithoutImpl } =
      await import('../../src/logger/redactor');

    expect(redactWithoutImpl({ password: 'somepassword' })).toBe(failed);
    const { redactUrl: redactUrlWithoutImpl } = await import('../../src/logger/redactor');
    expect(
      decodeURIComponent(redactUrlWithoutImpl('/a?input=%7B%22password%22%3A%22p%22%7D')),
    ).toBe('/a?input={"metadata":"[REDACTION FAILED]"}');

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

  test('fails closed (no raw data) if the redact implementation itself throws', async () => {
    vi.resetModules();
    vi.doMock('redact-object', () => ({
      default: () => {
        throw new Error('redact-object blew up');
      },
    }));

    const { failedRedactionValue: failed, redact: redactWithBrokenImpl } =
      await import('../../src/logger/redactor');

    expect(redactWithBrokenImpl({ password: 'somepassword' })).toBe(failed);
    const { redactUrl: redactUrlWithBrokenImpl } = await import('../../src/logger/redactor');
    expect(
      decodeURIComponent(redactUrlWithBrokenImpl('/a?input=%7B%22password%22%3A%22p%22%7D')),
    ).toBe('/a?input={"metadata":"[REDACTION FAILED]"}');

    const { Logger: FreshLogger } = await import('../../src/logger/log');
    const logSpy = vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
    new FreshLogger({ mode: 'json', silent: false }).info('login', { password: 'somepassword' });
    const [[line]] = logSpy.mock.calls;
    expect(line).toContain('"metadata":"[REDACTION FAILED]"');
    expect(line).not.toContain('somepassword');
    logSpy.mockRestore();

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

describe('Logger Integration - Request ID Color', () => {
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

  test('should format message with color based on requestId and metadata with gray', () => {
    const requestId = 'test-request-id';
    const color = getRandomColor(requestId);

    let output = '';
    requestContextStorage.run({ color, requestId }, () => {
      output = testLoggerCall({
        level: 'info',
        message: 'hello from request',
        metadata: { foo: 'bar' },
        options: { color: true, mode: 'pretty' },
      });
    });

    const expectedColoredMessage = color('hello from request');
    expect(output).toContain(expectedColoredMessage);
    expect(output).toContain(chalkInstance.gray(`request=${requestId}`));

    const expectedMetadataStr = JSON.stringify({ foo: 'bar' }, undefined, 5);
    expect(output).toContain(chalkInstance.gray(expectedMetadataStr));
  });

  test('lets metadata explicitly override the auto-detected requestId', () => {
    let output = '';
    requestContextStorage.run({ requestId: 'auto-request-id' }, () => {
      output = testLoggerCall({
        level: 'info',
        message: 'override test',
        metadata: { requestId: 'explicit-request-id' },
        options: { mode: 'json' },
      });
    });

    expect(JSON.parse(output)).toStrictEqual(
      expect.objectContaining({ requestId: 'explicit-request-id' }),
    );
    expect(JSON.parse(output)).not.toHaveProperty('context');
  });
});

describe('Logger Integration - Trace Context', () => {
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('includes traceId and spanId in the log entry when an active span context exists', () => {
    let output = '';
    context.with(trace.setSpanContext(context.active(), validSpanContext), () => {
      output = testLoggerCall({
        level: 'info',
        message: 'traced log',
        options: { mode: 'json' },
      });
    });

    expect(JSON.parse(output)).toMatchObject({
      spanId: validSpanContext.spanId,
      traceId: validSpanContext.traceId,
    });
  });

  test('hands every entry, with its trace context, to a registered browser log sink', () => {
    const sink = createFakeSink();
    registerBrowserLogSink(sink);

    try {
      context.with(trace.setSpanContext(context.active(), validSpanContext), () => {
        testLoggerCall({ level: 'info', message: 'browser traced log', options: { mode: 'json' } });
      });
    } finally {
      registerBrowserLogSink(undefined);
    }

    expect(sink.pushLog).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        message: 'browser traced log',
        spanId: validSpanContext.spanId,
        traceId: validSpanContext.traceId,
      }),
    );
  });

  test('keeps logging to the console when the browser log sink throws', () => {
    const sink = createFakeSink();
    sink.pushLog.mockImplementation(() => {
      throw new Error('sink down');
    });
    registerBrowserLogSink(sink);

    try {
      const output = testLoggerCall({
        level: 'info',
        message: 'still logged',
        options: { mode: 'json' },
      });
      expect(JSON.parse(output)).toMatchObject({ message: 'still logged' });
    } finally {
      registerBrowserLogSink(undefined);
    }
  });

  test('a silent logger does not reach the browser log sink', () => {
    const sink = createFakeSink();
    registerBrowserLogSink(sink);

    try {
      new Logger({ silent: true }).info('muted');
    } finally {
      registerBrowserLogSink(undefined);
    }

    expect(sink.pushLog).not.toHaveBeenCalled();
  });
});

describe('runWithRequestContext', () => {
  beforeAll(() => {
    context.disable();
    context.setGlobalContextManager(createAsyncHooksContextManager().enable());
  });

  afterAll(() => {
    context.disable();
  });

  test('still applies the request-scoped store when no span is available', () => {
    runWithRequestContext(undefined, { requestId: 'spanless-request-id' }, () => {
      expect(getRequestId()).toBe('spanless-request-id');
      expect(getTraceContext()).toBeUndefined();
    });
  });

  test('re-enters both the given span and the given request-scoped store in one call', () => {
    const span = trace.wrapSpanContext(validSpanContext);

    runWithRequestContext(span, { requestId: 'combined-request-id' }, () => {
      expect(getTraceContext()).toStrictEqual({
        spanId: validSpanContext.spanId,
        traceId: validSpanContext.traceId,
      });
      expect(getRequestId()).toBe('combined-request-id');
    });
  });
});

describe('setRequestId', () => {
  beforeAll(() => {
    context.disable();
    context.setGlobalContextManager(createAsyncHooksContextManager().enable());
  });

  afterAll(() => {
    context.disable();
  });

  afterEach(() => {
    setRequestId(undefined);
    registerBrowserLogSink(undefined);
    vi.restoreAllMocks();
  });

  test('is the fallback outside a request; a request context’s own id wins inside one', () => {
    setRequestId('app-request-id');

    expect(getRequestId()).toBe('app-request-id');
    requestContextStorage.run({ requestId: 'store-request-id' }, () => {
      expect(getRequestId()).toBe('store-request-id');
    });
  });

  test('log entries pushed to the browser log sink carry the request id', () => {
    vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
    const sink = createFakeSink();
    registerBrowserLogSink(sink);

    setRequestId('app-request-id');
    new Logger({ silent: false }).info('tagged');

    expect(sink.pushLog).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'tagged', requestId: 'app-request-id' }),
    );
  });

  test('falls back to "no-id" again once cleared, with no request context', () => {
    setRequestId('app-request-id');
    expect(getRequestId()).toBe('app-request-id');

    setRequestId(undefined);
    expect(getRequestId()).toBe('no-id');
  });
});

describe('setClientId', () => {
  beforeAll(() => {
    context.disable();
    context.setGlobalContextManager(createAsyncHooksContextManager().enable());
  });

  afterAll(() => {
    context.disable();
  });

  afterEach(() => {
    setClientId(undefined);
    registerBrowserLogSink(undefined);
    vi.restoreAllMocks();
  });

  test('is undefined until set; a request context’s own clientId wins over the pinned one', () => {
    expect(getClientId()).toBeUndefined();

    setClientId('page-client-id');
    expect(getClientId()).toBe('page-client-id');
    requestContextStorage.run({ clientId: 'store-client-id' }, () => {
      expect(getClientId()).toBe('store-client-id');
    });
  });

  test('log entries carry the client id and request id once, at the top level only', () => {
    vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
    setClientId('page-client-id');
    let output = '';
    requestContextStorage.run({ requestId: 'req-1' }, () => {
      output = testLoggerCall({ level: 'info', message: 'tagged', options: { mode: 'json' } });
    });

    const parsed: unknown = JSON.parse(output);
    expect(parsed).toMatchObject({ clientId: 'page-client-id', requestId: 'req-1' });
    expect(parsed).not.toHaveProperty('context');
  });

  test('metadata may override the clientId, which is then not repeated in the context', () => {
    vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
    setClientId('page-client-id');

    const output = testLoggerCall({
      level: 'info',
      message: 'override',
      metadata: { clientId: 'explicit-client-id', foo: 'bar' },
      options: { mode: 'json' },
    });

    expect(JSON.parse(output)).toMatchObject({
      clientId: 'explicit-client-id',
      context: { foo: 'bar' },
    });
    expect(JSON.parse(output)).not.toHaveProperty('context.clientId');
  });

  test('log entries pushed to the browser log sink carry the client id', () => {
    vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
    const sink = createFakeSink();
    registerBrowserLogSink(sink);

    setClientId('page-client-id');
    new Logger({ silent: false }).info('tagged');

    expect(sink.pushLog).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'page-client-id', message: 'tagged' }),
    );
  });

  test('spans get client.id next to request.id', () => {
    const startSpanSpy = vi.spyOn(tracer, 'startSpan');
    setClientId('page-client-id');

    requestContextStorage.run({ requestId: 'req-1' }, () => {
      startSpanWithRequestId('test-span');
    });

    expect(startSpanSpy).toHaveBeenCalledWith(
      'test-span',
      { attributes: { 'client.id': 'page-client-id', 'request.id': 'req-1' } },
      undefined,
    );
  });
});

describe('startRequestScope', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('starts every scope with a fresh requestId and tags its span with it', () => {
    const startSpanSpy = vi.spyOn(tracer, 'startSpan');

    const first = startRequestScope('op', { root: true });
    const second = startRequestScope('op');

    expect(first.requestId).toMatch(/^[\dA-Za-z]{22}$/u);
    expect(second.requestId).not.toBe(first.requestId);
    expect(startSpanSpy).toHaveBeenNthCalledWith(
      1,
      'op',
      { attributes: { 'request.id': first.requestId }, root: true },
      undefined,
    );
    first.span.end();
    second.span.end();
  });

  test('never repeats a requestId across 10k scopes', () => {
    const requestIds = new Set(
      Array.from({ length: 10_000 }, () => {
        const scope = startRequestScope('op');
        scope.span.end();
        return scope.requestId;
      }),
    );

    expect(requestIds.size).toBe(10_000);
  });

  test('run() re-enters the scope’s requestId and span, which do not leak outside it', () => {
    context.disable();
    context.setGlobalContextManager(createAsyncHooksContextManager().enable());
    try {
      const scope = startRequestScope('op');
      const spanContext = scope.span.spanContext();

      const seen = scope.run(() => ({ requestId: getRequestId(), span: trace.getActiveSpan() }));

      expect(seen.requestId).toBe(scope.requestId);
      expect(seen.span?.spanContext()).toStrictEqual(spanContext);
      expect(getRequestId()).toBe('no-id');
      scope.span.end();
    } finally {
      context.disable();
    }
  });
});

describe('startSpanWithRequestId', () => {
  beforeAll(() => {
    context.disable();
    context.setGlobalContextManager(createAsyncHooksContextManager().enable());
  });

  afterAll(() => {
    context.disable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('auto-attaches request.id from the active request context', () => {
    const startSpanSpy = vi.spyOn(tracer, 'startSpan');

    requestContextStorage.run({ requestId: 'auto-request-id' }, () => {
      startSpanWithRequestId('test-span', { attributes: { foo: 'bar' } });
    });

    expect(startSpanSpy).toHaveBeenCalledWith(
      'test-span',
      { attributes: { foo: 'bar', 'request.id': 'auto-request-id' } },
      undefined,
    );
  });

  test('omits request.id when there is no active request context', () => {
    const startSpanSpy = vi.spyOn(tracer, 'startSpan');

    startSpanWithRequestId('test-span', { attributes: { foo: 'bar' } });

    expect(startSpanSpy).toHaveBeenCalledWith(
      'test-span',
      { attributes: { foo: 'bar' } },
      undefined,
    );
  });

  test('lets an explicitly-specified request.id attribute win over the auto-set one', () => {
    const startSpanSpy = vi.spyOn(tracer, 'startSpan');

    requestContextStorage.run({ requestId: 'auto-request-id' }, () => {
      startSpanWithRequestId('test-span', { attributes: { 'request.id': 'explicit-request-id' } });
    });

    expect(startSpanSpy).toHaveBeenCalledWith(
      'test-span',
      { attributes: { 'request.id': 'explicit-request-id' } },
      undefined,
    );
  });

  test('forwards the given parent context to tracer.startSpan', () => {
    const startSpanSpy = vi.spyOn(tracer, 'startSpan');
    const parentContext = trace.setSpanContext(context.active(), validSpanContext);

    startSpanWithRequestId('test-span', {}, parentContext);

    expect(startSpanSpy).toHaveBeenCalledWith('test-span', { attributes: {} }, parentContext);
  });
});

describe('Logger Context - no active request context', () => {
  test('getRequestId returns "no-id"', () => {
    expect(getRequestId()).toBe('no-id');
  });

  test('getTraceContext returns undefined', () => {
    expect(getTraceContext()).toBeUndefined();
  });

  test('getRequestContext returns undefined', () => {
    expect(getRequestContext()).toBeUndefined();
  });

  test('getColor returns the default color', () => {
    expect(getColor()).toBe(defaultColor);
  });

  test.each([
    { label: 'a valid request context', value: { requestId: 'abc' } },
    { label: 'a context without a requestId (it is optional)', value: { other: 'field' } },
  ])('isRequestContext recognizes $label', ({ value }) => {
    expect(isRequestContext(value)).toBe(true);
  });

  test.each([
    { label: 'null', value: null },
    { label: 'a string', value: 'not-an-object' },
    { label: 'a number', value: 42 },
    { label: 'an array', value: ['requestId'] },
    { label: 'a non-string requestId', value: { requestId: 42 } },
    { label: 'a non-function color', value: { color: 'red' } },
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

  test('getRequestId and getRequestContext reflect the active store', () => {
    requestContextStorage.run({ requestId: 'store-request' }, () => {
      expect(getRequestId()).toBe('store-request');
      expect(getRequestContext()).toStrictEqual({ requestId: 'store-request' });
    });
  });

  test('getColor returns the store color when one is explicitly set', () => {
    const explicitColor = getRandomColor('explicit-color-id');
    requestContextStorage.run({ color: explicitColor, requestId: 'store-request' }, () => {
      expect(getColor()).toBe(explicitColor);
    });
  });

  test('getColor falls back to a random color derived from the store requestId', () => {
    requestContextStorage.run({ requestId: 'derived-color-id' }, () => {
      expect(getColor()).toBe(getRandomColor('derived-color-id'));
    });
  });

  test('getTraceContext returns the active span context when it is valid', () => {
    context.with(trace.setSpanContext(context.active(), validSpanContext), () => {
      expect(getTraceContext()).toStrictEqual({
        spanId: validSpanContext.spanId,
        traceId: validSpanContext.traceId,
      });
    });
  });

  test('getTraceContext returns undefined when the active span context is invalid', () => {
    const invalidSpanContext = { ...validSpanContext, spanId: '0000000000000000' };
    context.with(trace.setSpanContext(context.active(), invalidSpanContext), () => {
      expect(getTraceContext()).toBeUndefined();
    });
  });

  test('formatPretty colorizes using the active store when the entry has no context', () => {
    requestContextStorage.run({ requestId: 'format-store-id' }, () => {
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

  test('formatPretty with color uses the entry’s requestId regardless of any active store', () => {
    const entry: LogEntry = {
      level: 'info',
      message: 'explicit request',
      requestId: 'explicit-in-entry',
      timestamp: '2024-01-01',
    };
    const output = formatPretty(entry, true);
    expect(output).toContain(getRandomColor('explicit-in-entry')('explicit request'));
  });

  test('formatPretty prints the request and client ids before the trace ids', () => {
    const entry: LogEntry = {
      clientId: 'client-1',
      level: 'info',
      message: 'ids',
      requestId: 'req-1',
      spanId: 'span-1',
      timestamp: '2024-01-01',
      traceId: 'trace-1',
    };
    expect(formatPretty(entry, false)).toBe(
      '[2024-01-01] INFO : ids request=req-1 client=client-1 trace=trace-1 span=span-1',
    );
  });

  test('formatPretty appends trace and span ids when both are present', () => {
    const entry: LogEntry = {
      level: 'info',
      message: 'traced',
      spanId: 'b7ad6b7169203331',
      timestamp: '2024-01-01',
      traceId: '0af7651916cd43dd8448eb211c80319c',
    };
    expect(formatPretty(entry, false)).toBe(
      '[2024-01-01] INFO : traced trace=0af7651916cd43dd8448eb211c80319c span=b7ad6b7169203331',
    );
  });

  test('formatPretty colors the trace/span suffix when color is enabled', () => {
    const entry: LogEntry = {
      level: 'info',
      message: 'traced',
      spanId: 'b7ad6b7169203331',
      timestamp: '2024-01-01',
      traceId: '0af7651916cd43dd8448eb211c80319c',
    };
    const output = formatPretty(entry, true);
    expect(output).toContain(
      chalkInstance.gray('trace=0af7651916cd43dd8448eb211c80319c span=b7ad6b7169203331'),
    );
  });

  test('formatPretty appends an empty span when only the trace id is present', () => {
    const entry: LogEntry = {
      level: 'info',
      message: 'traced',
      timestamp: '2024-01-01',
      traceId: '0af7651916cd43dd8448eb211c80319c',
    };
    expect(formatPretty(entry, false)).toBe(
      '[2024-01-01] INFO : traced trace=0af7651916cd43dd8448eb211c80319c span=',
    );
  });

  test('formatPretty with color leaves the message uncolored when there is no request id and no active store', () => {
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

  test('does not throw when writing to OTel/browser-sink outputs while isBrowser() is true', () => {
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

describe('requestId in a server request context', () => {
  beforeAll(() => {
    context.disable();
    context.setGlobalContextManager(createAsyncHooksContextManager().enable());
  });

  beforeEach(() => {
    vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    context.disable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('getRequestId reads the request id, and is "no-id" outside a request', () => {
    requestContextStorage.run({ requestId: 'req-1' }, () => {
      expect(getRequestId()).toBe('req-1');
      expect(isRequestContext(getRequestContext())).toBe(true);
    });
    expect(getRequestId()).toBe('no-id');
  });

  test('log entries carry the request id once, at the top level', () => {
    let output = '';
    requestContextStorage.run({ requestId: 'req-2' }, () => {
      output = testLoggerCall({ level: 'info', message: 'in request', options: { mode: 'json' } });
    });

    const parsed: unknown = JSON.parse(output);
    expect(parsed).toMatchObject({ requestId: 'req-2' });
    expect(parsed).not.toHaveProperty('context');
  });

  test('spans started inside a request get request.id', () => {
    const startSpanSpy = vi.spyOn(tracer, 'startSpan');

    requestContextStorage.run({ requestId: 'req-3' }, () => {
      startSpanWithRequestId('test-span');
    });

    expect(startSpanSpy).toHaveBeenCalledWith(
      'test-span',
      { attributes: { 'request.id': 'req-3' } },
      undefined,
    );
  });

  test('formatPretty colors by the entry’s requestId', () => {
    const entry: LogEntry = {
      level: 'info',
      message: 'colored',
      requestId: 'req-color',
      timestamp: '2024-01-01',
    };

    expect(formatPretty(entry, true)).toContain(getRandomColor('req-color')('colored'));
  });
});
