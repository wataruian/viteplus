import { vi } from 'vite-plus/test';

class ExitError extends Error {
  public readonly code: string | number | null | undefined;

  public constructor(code: string | number | null | undefined) {
    super(`process.exit(${String(code)})`);
    this.name = 'ExitError';
    this.code = code;
  }
}

const stubProcessExit = () =>
  vi.spyOn(globalThis.process, 'exit').mockImplementation((code) => {
    throw new ExitError(code);
  });

export { ExitError, stubProcessExit };
