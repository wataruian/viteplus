import { AsyncLocalStorage } from 'node:async_hooks';

import {
  type Context,
  type ContextManager,
  ROOT_CONTEXT,
  context,
  trace,
} from '@opentelemetry/api';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vite-plus/test';

import type * as TelemetryUtilsModule from '../src/utils/telemetry';

const importFresh = async (serviceName?: string): Promise<typeof TelemetryUtilsModule> => {
  vi.resetModules();
  vi.stubEnv('OTEL_SERVICE_NAME', serviceName);
  return await import('../src/utils/telemetry');
};

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

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('tracer', () => {
  test('is created using OTEL_SERVICE_NAME when set', async () => {
    const { tracer } = await importFresh('my-tracer-service');
    expect(tracer).toBeDefined();
  });

  test('falls back to "application" when OTEL_SERVICE_NAME is unset', async () => {
    const { tracer } = await importFresh(undefined);
    expect(tracer).toBeDefined();
  });
});

describe('getMeter', () => {
  test('returns a meter using OTEL_SERVICE_NAME when set', async () => {
    const { getMeter } = await importFresh('my-meter-service');
    expect(getMeter()).toBeDefined();
  });

  test('returns a meter falling back to "application" when OTEL_SERVICE_NAME is unset', async () => {
    const { getMeter } = await importFresh(undefined);
    expect(getMeter()).toBeDefined();
  });
});

describe('runWithSpan', () => {
  beforeAll(() => {
    context.disable();
    context.setGlobalContextManager(createAsyncHooksContextManager().enable());
  });

  afterAll(() => {
    context.disable();
  });

  test('makes the given span the active span for the duration of fn', async () => {
    const { runWithSpan, tracer } = await importFresh('span-service');
    const span = tracer.startSpan('test-span');

    const activeSpanContext = runWithSpan(span, () => trace.getSpanContext(context.active()));

    expect(activeSpanContext).toStrictEqual(span.spanContext());
    span.end();
  });

  test('restores the previous context once fn returns', async () => {
    const { runWithSpan, tracer } = await importFresh('span-service');
    const span = tracer.startSpan('test-span');

    runWithSpan(span, () => {});

    expect(trace.getSpanContext(context.active())).toBeUndefined();
    span.end();
  });
});
