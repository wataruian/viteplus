import type * as CommonLoggerModule from '@lightproject/common/logger';
import type * as UtilsModule from '@lightproject/common/utils';
import { generateShortUuid } from '@lightproject/common/utils';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vite-plus/test';
import { z } from 'zod';

import type * as TrpcProviderModule from '../../src/providers/trpc-provider';
import { type RunningBackend, backendRuntimes } from './helpers/backend';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const parsedLogEntrySchema = z.object({
  clientId: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  level: z.string(),
  message: z.string(),
  requestId: z.string().optional(),
  timestamp: z.string(),
});

type ParsedLogEntry = z.infer<typeof parsedLogEntrySchema>;

const trpcResultSchema = z.object({
  code: z.number(),
  data: z.object({ reply: z.string() }),
  message: z.string(),
  requestId: z.string(),
  success: z.boolean(),
});

const testApiUrl = 'http://backend.test';
const defaultApiUrl = 'http://localhost:3000';
const shortUuidPattern = /^[\dA-Za-z]{22}$/u;
const isoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const parseLogEntries = (calls: readonly unknown[][]): ParsedLogEntry[] =>
  calls.map(([line]) => parsedLogEntrySchema.parse(JSON.parse(String(line))));

const findEntry = (entries: ParsedLogEntry[], message: string): ParsedLogEntry => {
  const entry = entries.find((candidate) => candidate.message.includes(message));
  if (entry === undefined) {
    throw new Error(`expected a log entry containing "${message}"`);
  }
  return entry;
};

const renderApp = async (backend: RunningBackend, apiUrl: string | undefined) => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('LOG_FORMAT', 'json');
  vi.stubEnv('LOG_LEVEL', 'info');

  vi.doMock('@lightproject/common/configs', () => ({
    apiBaseUrl: apiUrl ?? defaultApiUrl,
    trpcUrl: `${apiUrl ?? defaultApiUrl}/trpc`,
  }));

  vi.doMock('../../src/config', () => ({
    config: { viteApiUrl: apiUrl ?? defaultApiUrl },
    get: (key: string) => (key === 'VITE_API_URL' ? apiUrl : undefined),
  }));

  vi.doMock('../../src/providers/trpc-provider', async (importOriginal) => {
    const actual = await importOriginal<typeof TrpcProviderModule>();
    return {
      ...actual,
      trpcClient: actual.createAppTrpcClient({
        fetch: async (input, init) => {
          const requestInit: RequestInit | undefined =
            init === undefined ? undefined : { ...init, signal: init.signal ?? null };
          return await backend.fetch(input, requestInit);
        },
        url: `${backend.url}/trpc`,
      }),
    };
  });

  const logSpy = vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});

  const { ClientIdProvider, ModeProvider, ThemeProvider } =
    await import('@lightproject/design-system/context');
  const { default: App } = await import('../../src/app');

  const container = globalThis.document.createElement('div');
  globalThis.document.body.append(container);
  const root: Root = createRoot(container);

  await act(async () => {
    root.render(
      <ClientIdProvider createId={generateShortUuid}>
        <ThemeProvider>
          <ModeProvider>
            <App />
          </ModeProvider>
        </ThemeProvider>
      </ClientIdProvider>,
    );
    await Promise.resolve();
  });

  await vi.waitFor(() => {
    expect(
      parseLogEntries(logSpy.mock.calls).some((entry) =>
        entry.message.includes('tRPC Sample Result'),
      ),
    ).toBe(true);
  });

  return {
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
      logSpy.mockRestore();
      vi.doUnmock('../../src/providers/trpc-provider');
      vi.doUnmock('../../src/config');
      vi.doUnmock('@lightproject/common/configs');
    },
    container,
    entries: parseLogEntries(logSpy.mock.calls),
    logSpy,
  };
};

const trpcSampleButton = (container: HTMLDivElement): HTMLButtonElement => {
  const button = container.querySelector('button#trpc-sample');
  if (!(button instanceof globalThis.HTMLButtonElement)) {
    throw new TypeError('expected the tRPC sample button to render');
  }
  return button;
};

const settleInsideAct = async (isSettled: () => boolean): Promise<void> => {
  await act(async () => {
    await vi.waitFor(() => {
      expect(isSettled()).toBe(true);
    });
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 0);
    });
  });
};

const sampleResultEntries = (logSpy: { mock: { calls: unknown[][] } }): ParsedLogEntry[] =>
  parseLogEntries(logSpy.mock.calls).filter((entry) =>
    entry.message.includes('tRPC Sample Result'),
  );

const assertRenderedHtml = (container: HTMLDivElement) => {
  expect(container.querySelector('#center')).not.toBeNull();
  expect(container.querySelector('h1')?.textContent).toBe('Get started');
  expect(container.querySelector('button#counter')?.tagName).toBe('BUTTON');
  expect(trpcSampleButton(container).textContent).toBe('Call tRPC sample');
  expect(trpcSampleButton(container).disabled).toBe(false);

  const heroImages = container.querySelectorAll('.hero img');
  expect(heroImages).toHaveLength(3);
  for (const img of heroImages) {
    expect(img.getAttribute('src')).toBeTruthy();
  }

  expect(container.querySelectorAll('.ticks')).toHaveLength(2);
  expect(container.querySelector('#spacer')).not.toBeNull();

  expect(container.querySelector('#docs h2')?.textContent).toBe('Documentation');
  expect(container.querySelector('#social h2')?.textContent).toBe('Connect with us');

  const socialLinks = [...container.querySelectorAll('#social a')].map((a) =>
    a.getAttribute('href'),
  );
  expect(socialLinks).toEqual(
    expect.arrayContaining([
      'https://github.com/vitejs/vite',
      'https://chat.vite.dev/',
      'https://x.com/vite_js',
      'https://bsky.app/profile/vite.dev',
    ]),
  );
};

const assertTrpcAndStartupLogs = (entries: ParsedLogEntry[]) => {
  const startEntry = findEntry(entries, 'Frontend Start');
  expect(startEntry.requestId).toMatch(shortUuidPattern);
  expect(startEntry.clientId).toMatch(shortUuidPattern);
  expect(startEntry.clientId).not.toBe(startEntry.requestId);
  expect(startEntry.context?.['platform']).toEqual(expect.any(String));
  expect(startEntry.context?.['timestamp']).toMatch(isoTimestampPattern);

  const trpcEntry = findEntry(entries, 'tRPC Sample Result');
  const result = trpcResultSchema.parse(trpcEntry.context?.['result']);
  expect(result.success).toBe(true);
  expect(result.code).toBe(200);
  expect(result.message).toBe('Success');
  expect(result.data.reply).toBe('Hello Test!');
  expect(result.requestId).toBe(startEntry.requestId);
  expect(trpcEntry.requestId).toBe(startEntry.requestId);
};

describe.each(backendRuntimes)('App on the $name backend', ({ start }) => {
  const state: { backend: RunningBackend | undefined } = { backend: undefined };

  const getBackend = (): RunningBackend => {
    if (state.backend === undefined) {
      throw new Error('backend has not started yet');
    }
    return state.backend;
  };

  beforeAll(async () => {
    state.backend = await start();
  });

  afterAll(async () => {
    await state.backend?.stop();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test('renders the expected page structure and logs startup + tRPC activity when VITE_API_URL is set', async () => {
    const { cleanup, container, entries } = await renderApp(getBackend(), testApiUrl);
    try {
      assertRenderedHtml(container);

      const apiUrlEntry = findEntry(entries, 'VITE_API_URL is set');
      expect(apiUrlEntry.message).toBe(`VITE_API_URL is set: ${testApiUrl}`);
      expect(apiUrlEntry.level).toBe('info');

      assertTrpcAndStartupLogs(entries);
    } finally {
      cleanup();
    }
  });

  test('falls back to the default API URL and still logs the tRPC result when VITE_API_URL is unset', async () => {
    const { cleanup, entries } = await renderApp(getBackend(), undefined);
    try {
      const notSetEntry = findEntry(entries, 'VITE_API_URL is not set');
      expect(notSetEntry.message).toBe(
        `VITE_API_URL is not set, using default URL: ${defaultApiUrl}`,
      );

      assertTrpcAndStartupLogs(entries);
    } finally {
      cleanup();
    }
  });

  test('re-runs the sample tRPC call on button click under a fresh request id the backend adopts', async () => {
    const { cleanup, container, entries, logSpy } = await renderApp(getBackend(), testApiUrl);
    try {
      const startEntry = findEntry(entries, 'Frontend Start');
      const button = trpcSampleButton(container);

      act(() => {
        button.click();
      });
      expect(button.disabled).toBe(true);
      expect(button.textContent).toBe('Calling tRPC…');

      await settleInsideAct(() => sampleResultEntries(logSpy).length === 2);
      expect(button.disabled).toBe(false);
      expect(button.textContent).toBe('Call tRPC sample');

      const [, clickEntry] = sampleResultEntries(logSpy);
      const result = trpcResultSchema.parse(clickEntry.context?.['result']);
      expect(result.success).toBe(true);
      expect(result.data.reply).toBe('Hello Test!');
      expect(clickEntry.requestId).toMatch(shortUuidPattern);
      expect(clickEntry.requestId).not.toBe(startEntry.requestId);
      expect(result.requestId).toBe(clickEntry.requestId);
      expect(clickEntry.clientId).toBe(startEntry.clientId);
    } finally {
      cleanup();
    }
  });

  test('keeps the counter value when the tRPC sample button re-renders the app', async () => {
    const { cleanup, container, logSpy } = await renderApp(getBackend(), testApiUrl);
    try {
      const counter = container.querySelector('button#counter');
      if (!(counter instanceof globalThis.HTMLButtonElement)) {
        throw new TypeError('expected the counter button to render');
      }

      act(() => {
        counter.click();
        counter.click();
      });
      expect(counter.textContent).toBe('Count is 2');

      act(() => {
        trpcSampleButton(container).click();
      });
      await settleInsideAct(() => sampleResultEntries(logSpy).length === 2);
      expect(counter.textContent).toBe('Count is 2');

      act(() => {
        counter.click();
      });
      expect(counter.textContent).toBe('Count is 3');
    } finally {
      cleanup();
    }
  });
});

const successfulTrpcResult = {
  code: 200,
  data: { reply: 'Hello Test!' },
  message: 'Success',
  requestId: 'test-request',
  success: true,
};

const renderAppWithMocks = async (options: {
  configModule: {
    config: { viteApiUrl: string | undefined };
    get?: (key: string) => string | undefined;
  };
  trpcQuery: () => unknown;
}) => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('LOG_FORMAT', 'json');
  vi.stubEnv('LOG_LEVEL', 'info');

  vi.doMock('@lightproject/common/configs', () => ({
    apiBaseUrl: defaultApiUrl,
  }));

  vi.doMock('../../src/config', () => ({
    config: options.configModule.config,
    get: options.configModule.get ?? (() => undefined),
  }));

  vi.doMock('../../src/providers/trpc-provider', () => ({
    trpcClient: {
      test: {
        hello: {
          query: options.trpcQuery,
        },
      },
    },
  }));

  const logSpy = vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});

  const { ClientIdProvider, ModeProvider, ThemeProvider } =
    await import('@lightproject/design-system/context');
  const { default: App } = await import('../../src/app');

  const container = globalThis.document.createElement('div');
  globalThis.document.body.append(container);
  const root: Root = createRoot(container);

  await act(async () => {
    root.render(
      <ClientIdProvider createId={generateShortUuid}>
        <ThemeProvider>
          <ModeProvider>
            <App />
          </ModeProvider>
        </ThemeProvider>
      </ClientIdProvider>,
    );
    await Promise.resolve();
  });

  return {
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
      logSpy.mockRestore();
      vi.doUnmock('../../src/providers/trpc-provider');
      vi.doUnmock('../../src/config');
      vi.doUnmock('@lightproject/common/configs');
    },
    container,
    logSpy,
  };
};

describe('App error handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test.each<[string, unknown]>([
    ['an Error instance', new Error('tRPC boom')],
    ['a non-Error value', 'tRPC boom'],
  ])(
    'records a span exception and logs an error when the tRPC call rejects with %s, without blocking initialization',
    async (_label, rejection) => {
      const { cleanup, logSpy } = await renderAppWithMocks({
        configModule: { config: { viteApiUrl: undefined } },
        trpcQuery: () => {
          throw rejection;
        },
      });

      try {
        await vi.waitFor(() => {
          expect(
            parseLogEntries(logSpy.mock.calls).some((entry) =>
              entry.message.includes('Failed to call tRPC server'),
            ),
          ).toBe(true);
        });

        const entries = parseLogEntries(logSpy.mock.calls);
        expect(findEntry(entries, 'Failed to call tRPC server').level).toBe('error');

        findEntry(entries, 'Frontend Start');
        findEntry(entries, 'VITE_API_URL is not set');
      } finally {
        cleanup();
      }
    },
  );

  test.each<[string, () => unknown]>([
    ['an Error instance', () => new Error('config boom')],
    ['a non-Error value', () => 'config boom'],
  ])(
    'records a span exception and logs an error when initialization fails outside the tRPC call with %s',
    async (_label, makeRejection) => {
      const { cleanup, logSpy } = await renderAppWithMocks({
        configModule: {
          config: {
            get viteApiUrl(): string | undefined {
              throw makeRejection();
            },
          },
        },
        trpcQuery: () => successfulTrpcResult,
      });

      try {
        await vi.waitFor(() => {
          expect(
            parseLogEntries(logSpy.mock.calls).some((entry) =>
              entry.message.includes('Failed to initialize frontend'),
            ),
          ).toBe(true);
        });

        const entries = parseLogEntries(logSpy.mock.calls);
        expect(findEntry(entries, 'Failed to initialize frontend').level).toBe('error');
      } finally {
        cleanup();
      }
    },
  );

  test('logs an error and re-enables the button when a clicked tRPC sample call rejects', async () => {
    let shouldReject = false;
    const { cleanup, container, logSpy } = await renderAppWithMocks({
      configModule: { config: { viteApiUrl: undefined } },
      trpcQuery: () => {
        if (shouldReject) {
          throw new Error('tRPC boom');
        }
        return successfulTrpcResult;
      },
    });

    try {
      await vi.waitFor(() => {
        expect(sampleResultEntries(logSpy)).toHaveLength(1);
      });

      shouldReject = true;
      const button = trpcSampleButton(container);
      act(() => {
        button.click();
      });

      await settleInsideAct(() =>
        parseLogEntries(logSpy.mock.calls).some((entry) =>
          entry.message.includes('Failed to call tRPC server'),
        ),
      );
      expect(button.disabled).toBe(false);
      expect(
        findEntry(parseLogEntries(logSpy.mock.calls), 'Failed to call tRPC server').level,
      ).toBe('error');
    } finally {
      cleanup();
    }
  });

  test('still completes initialization when recording the tRPC exemplar metric fails', async () => {
    vi.doMock('@lightproject/common/utils', async (importOriginal) => ({
      ...(await importOriginal<typeof UtilsModule>()),
      recordGaugeWithExemplar: vi.fn().mockRejectedValue(new Error('otlp unreachable')),
    }));

    const unhandledRejectionSpy = vi.fn();
    const handleUnhandledRejection = (reason: unknown): void => {
      unhandledRejectionSpy(reason);
    };
    globalThis.process.on('unhandledRejection', handleUnhandledRejection);

    const { cleanup, logSpy } = await renderAppWithMocks({
      configModule: { config: { viteApiUrl: undefined } },
      trpcQuery: () => successfulTrpcResult,
    });

    try {
      await vi.waitFor(() => {
        expect(
          parseLogEntries(logSpy.mock.calls).some((entry) =>
            entry.message.includes('Frontend Start'),
          ),
        ).toBe(true);
      });

      expect(unhandledRejectionSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.process.off('unhandledRejection', handleUnhandledRejection);
      cleanup();
      vi.doUnmock('@lightproject/common/utils');
    }
  });

  test('swallows rejections from the initialize effect and the tRPC sample button when starting the span itself throws', async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('LOG_FORMAT', 'json');
    vi.stubEnv('LOG_LEVEL', 'info');

    vi.doMock('@lightproject/common/configs', () => ({
      apiBaseUrl: defaultApiUrl,
    }));

    vi.doMock('@lightproject/common/logger', async () => {
      const actual = await vi.importActual<typeof CommonLoggerModule>(
        '@lightproject/common/logger',
      );
      return {
        ...actual,
        startRequestScope: () => {
          throw new Error('failed to start span');
        },
      };
    });

    vi.doMock('../../src/config', () => ({
      config: { viteApiUrl: undefined },
    }));

    const queryMock = vi.fn(() => successfulTrpcResult);
    vi.doMock('../../src/providers/trpc-provider', () => ({
      trpcClient: {
        test: {
          hello: {
            query: queryMock,
          },
        },
      },
    }));

    const logSpy = vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
    const unhandledRejectionSpy = vi.fn();
    const handleUnhandledRejection = (reason: unknown): void => {
      unhandledRejectionSpy(reason);
    };
    globalThis.process.on('unhandledRejection', handleUnhandledRejection);

    const { ClientIdProvider, ModeProvider, ThemeProvider } =
      await import('@lightproject/design-system/context');
    const { default: App } = await import('../../src/app');

    const container = globalThis.document.createElement('div');
    globalThis.document.body.append(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(
        <ClientIdProvider createId={generateShortUuid}>
          <ThemeProvider>
            <ModeProvider>
              <App />
            </ModeProvider>
          </ThemeProvider>
        </ClientIdProvider>,
      );
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 0);
      });
    });

    const button = trpcSampleButton(container);
    await act(async () => {
      button.click();
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 0);
      });
    });
    expect(button.disabled).toBe(false);

    expect(queryMock).not.toHaveBeenCalled();
    expect(unhandledRejectionSpy).not.toHaveBeenCalled();
    expect(
      parseLogEntries(logSpy.mock.calls).some((entry) => entry.message.includes('Frontend Start')),
    ).toBe(false);

    globalThis.process.off('unhandledRejection', handleUnhandledRejection);
    act(() => {
      root.unmount();
    });
    container.remove();
    logSpy.mockRestore();
    vi.doUnmock('../../src/providers/trpc-provider');
    vi.doUnmock('../../src/config');
    vi.doUnmock('@lightproject/common/logger');
    vi.doUnmock('@lightproject/common/configs');
  });
});
