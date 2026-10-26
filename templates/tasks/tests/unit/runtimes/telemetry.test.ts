import { logger } from '@lightproject/common/logger';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

afterEach(() => {
  vi.doUnmock('@lightproject/common/server');
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('startTelemetry', () => {
  test('logs a setup failure once instead of throwing, and keeps going without telemetry', async () => {
    const initializeContextPropagation = vi.fn<() => void>().mockImplementationOnce(() => {
      throw new Error('exporter misconfigured');
    });
    vi.doMock('@lightproject/common/server', () => ({
      initializeContextPropagation,
      initializeTelemetry: vi.fn(),
    }));
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const { startTelemetry } = await import('../../../src/runtimes/telemetry');

    await expect(startTelemetry()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      'Telemetry setup failed; continuing without it',
      expect.anything(),
    );
    await expect(startTelemetry()).resolves.toBeUndefined();
    expect(initializeContextPropagation).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });
});
