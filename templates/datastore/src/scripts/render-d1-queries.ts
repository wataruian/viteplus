const d1RenderedModules = ['crud.ts', 'tables.ts', 'worker-jobs.ts', 'script-locks.ts'] as const;

type D1RenderedModule = (typeof d1RenderedModules)[number];

const renames: readonly (readonly [RegExp, string])[] = [
  [/\bAnyPostgresDatabase\b/gu, 'D1Database'],
  [/\bPgTable\b/gu, 'SQLiteTable'],
  [/'drizzle-orm\/pg-core'/gu, "'drizzle-orm/sqlite-core'"],
  [/\bcreatePostgres(?=[A-Z])/gu, 'createD1'],
  [/\s*\.for\('update', \{ skipLocked: true \}\)/gu, ''],
];

const postgresOnly = /\b[Pp]g[A-Z]\w*|\b(?:Any)?Postgres[A-Z]\w*|postgres-js|\.for\(/u;

class UnsupportedQueryError extends Error {
  public constructor(file: D1RenderedModule, construct: string) {
    super(
      `src/postgres/${file}: "${construct}" has no D1 rendering; add a rename in render-d1-queries.ts or move it to a hand-written per-dialect file`,
    );
    this.name = 'UnsupportedQueryError';
  }
}

const renderD1Query = (file: D1RenderedModule, source: string) => {
  const rendered = renames.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    source,
  );
  const leftover = postgresOnly.exec(rendered);
  if (leftover !== null) {
    throw new UnsupportedQueryError(file, leftover[0]);
  }
  return rendered;
};

export { d1RenderedModules, postgresOnly, renames, renderD1Query, UnsupportedQueryError };
export type { D1RenderedModule };
