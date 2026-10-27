import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vite-plus/test';

import { bindLogger } from '../../src/logger/bind';
import { logger } from '../../src/logger/log';
import { context, trace } from '../../src/utils/telemetry';
import { createAsyncHooksContextManager } from './helpers/context-manager';

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

describe('bindLogger', () => {
  test.each(['debug', 'info', 'warn', 'error'] as const)(
    '%s writes through the shared logger inside the bound context',
    (level) => {
      const spanContext = {
        spanId: '0123456789abcdef',
        traceFlags: 1,
        traceId: '0123456789abcdef0123456789abcdef',
      };
      const active = trace.setSpanContext(context.active(), spanContext);
      const seen: (string | undefined)[] = [];
      vi.spyOn(logger, level).mockImplementation(() => {
        seen.push(trace.getSpanContext(context.active())?.traceId);
      });

      bindLogger(active)[level]('message', { key: 'value' });

      expect(logger[level]).toHaveBeenCalledWith('message', { key: 'value' });
      expect(seen).toStrictEqual([spanContext.traceId]);
    },
  );
});
