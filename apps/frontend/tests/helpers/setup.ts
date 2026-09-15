import { vi } from 'vite-plus/test';

const { importMetaEnvPath } = vi.hoisted(() => ({
  importMetaEnvPath: new globalThis.URL(
    '../../../../packages/common/src/environment/import-meta-env.ts',
    import.meta.url,
  ).pathname,
}));

vi.mock(importMetaEnvPath, () => ({ getImportMetaEnvValue: () => undefined }));
