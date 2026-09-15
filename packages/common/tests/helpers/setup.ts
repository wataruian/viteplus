import { vi } from 'vite-plus/test';

vi.mock('#import-meta-env', () => ({ getImportMetaEnvValue: () => undefined }));
