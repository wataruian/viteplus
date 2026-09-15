const getImportMetaEnvValue = (key: string): string | undefined =>
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.[key];

export { getImportMetaEnvValue };
