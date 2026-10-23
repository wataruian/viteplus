import { is, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  PgTable,
  UniqueConstraint,
  bigint,
  boolean,
  char,
  date,
  doublePrecision,
  foreignKey,
  getTableConfig,
  index,
  inet,
  integer,
  json,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { describe, expect, test, vi } from 'vite-plus/test';

import * as postgres from '../../src/postgres/schema';
import {
  UnsupportedSchemaError,
  renderD1Schema,
  renderExtras,
} from '../../src/scripts/render-d1-schema';
import { jobStatuses, newId, now } from '../../src/shared';

describe('renderD1Schema', () => {
  test('renders every exported table and ignores other exports', () => {
    const source = renderD1Schema(postgres);
    const tables = Object.entries(postgres).flatMap(([name, value]) =>
      is(value, PgTable) ? [[name, value] as const] : [],
    );

    for (const [name, table] of tables) {
      expect(source).toContain(`const ${name} = sqliteTable(\n  '${getTableConfig(table).name}',`);
    }
    expect(source).toContain(
      `export { ${tables
        .map(([name]) => name)
        .toSorted((a, b) => a.localeCompare(b))
        .join(', ')} };`,
    );
    expect(source).not.toContain('timestampColumn');
  });

  test('maps each supported column type and modifier', () => {
    const mood = pgEnum('mood', ['happy', 'sad']);
    const everything = pgTable('everything', {
      active: boolean('active').notNull().default(true),
      big: bigint('big', { mode: 'number' }),
      code: char('code', { length: 2 }),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(now),
      data: json('data'),
      double: doublePrecision('double'),
      feeling: mood('feeling'),
      id: uuid('id').primaryKey().$defaultFn(newId),
      label: varchar('label', { length: 10 }).unique('everything_label_uq'),
      meta: jsonb('meta').$type<{ a: number }>().notNull(),
      ratio: real('ratio'),
      small: smallint('small'),
      status: text('status', { enum: jobStatuses }),
      tag: text('tag', { enum: ['x', "y'z"] }).unique(),
      updatedAt: timestamp('updated_at').$onUpdateFn(now),
    });

    const source = renderD1Schema({ everything });

    for (const expected of [
      "active: integer('active', { mode: 'boolean' }).notNull().default(true)",
      "big: integer('big')",
      "code: text('code')",
      "createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(now)",
      "data: text('data', { mode: 'json' }).$type<(typeof postgres.everything.data)['_']['data']>()",
      "double: real('double')",
      "feeling: text('feeling', { enum: ['happy', 'sad'] })",
      "id: text('id').primaryKey().$defaultFn(newId)",
      "label: text('label').unique('everything_label_uq')",
      "ratio: real('ratio')",
      "small: integer('small')",
      "status: text('status', { enum: jobStatuses })",
      String.raw`tag: text('tag', { enum: ['x', 'y\'z'] }).unique()`,
      "updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$onUpdateFn(now)",
      "import { jobStatuses, newId, now } from '../shared';",
      "import type * as postgres from '../postgres/schema';",
      "import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';",
    ]) {
      expect(source).toContain(expected);
    }
    expect(source).not.toContain("from 'drizzle-orm';");
  });

  test('renders foreign keys, constraints and indexes, declaring referenced tables first', () => {
    const owners = pgTable('owners', { id: uuid('id').primaryKey() });
    const vets = pgTable('vets', { id: uuid('id').primaryKey() });
    const pets = pgTable(
      'pets',
      {
        kind: text('kind').notNull(),
        name: text('name').notNull(),
        ownerId: uuid('owner_id').references(() => owners.id, {
          onDelete: 'cascade',
          onUpdate: 'set null',
        }),
        parentId: uuid('parent_id'),
        vetId: uuid('vet_id').references(() => vets.id),
      },
      (table) => [
        primaryKey({ columns: [table.ownerId, table.name] }),
        unique('pets_kind_name_uq').on(table.kind, table.name),
        index('pets_kind_idx')
          .on(table.kind)
          .where(sql`kind <> 'fish'`),
        index('pets_name_idx').on(table.name),
      ],
    );

    const source = renderD1Schema({ owners, pets, vets });

    expect(source.indexOf("'owners'")).toBeLessThan(source.indexOf("'pets'"));
    expect(source.indexOf("'vets'")).toBeLessThan(source.indexOf("'pets'"));
    for (const expected of [
      "ownerId: text('owner_id').references(() => owners.id, { onDelete: 'cascade', onUpdate: 'set null' })",
      "vetId: text('vet_id').references(() => vets.id)",
      "index('pets_name_idx').on(table.name)",
      'primaryKey({ columns: [table.ownerId, table.name] })',
      "unique('pets_kind_name_uq').on(table.kind, table.name)",
      String.raw`index('pets_kind_idx').on(table.kind).where(sql.raw('kind <> \'fish\''))`,
      "import { sql } from 'drizzle-orm';",
    ]) {
      expect(source).toContain(expected);
    }
  });

  test('allows a table to reference itself', () => {
    const nodes = pgTable('nodes', {
      id: uuid('id').primaryKey(),
      parentId: uuid('parent_id').references((): AnyPgColumn => nodes.id),
    });

    expect(renderD1Schema({ nodes })).toContain(
      "parentId: text('parent_id').references(() => nodes.id)",
    );
  });

  const loopTables: Partial<Record<'b', { id: AnyPgColumn }>> = {};
  const loopA = pgTable('loop_a', {
    bId: uuid('b_id').references((): AnyPgColumn => {
      const target = loopTables.b;
      if (!target) {
        throw new Error('loop_b not defined yet');
      }
      return target.id;
    }),
    id: uuid('id').primaryKey(),
  });
  const loopB = pgTable('loop_b', {
    aId: uuid('a_id').references(() => loopA.id),
    id: uuid('id').primaryKey(),
  });
  loopTables.b = loopB;
  const parent = pgTable('parent', { a: uuid('a'), b: uuid('b') });

  test.each([
    ['numeric', { t: pgTable('t', { n: numeric('n') }) }, 'numeric has no exact SQLite equivalent'],
    ['serial', { t: pgTable('t', { n: serial('n') }) }, 'serial ids are not portable'],
    [
      'string timestamps',
      { t: pgTable('t', { n: timestamp('n', { mode: 'string' }) }) },
      "timestamp mode 'string'",
    ],
    ['date', { t: pgTable('t', { n: date('n') }) }, 'date columns have no D1 equivalent'],
    [
      'bigint mode bigint',
      { t: pgTable('t', { n: bigint('n', { mode: 'bigint' }) }) },
      "bigint mode 'bigint'",
    ],
    [
      'arrays',
      { t: pgTable('t', { n: integer('n').array() }) },
      'arrays have no SQLite equivalent',
    ],
    [
      'SQL defaults',
      { t: pgTable('t', { n: timestamp('n').defaultNow() }) },
      'SQL/object defaults are not portable',
    ],
    [
      'functions not from src/shared',
      { t: pgTable('t', { n: text('n').$defaultFn(() => 'x') }) },
      '$defaultFn must be a function or constant exported from src/shared',
    ],
    [
      'onUpdate functions not from src/shared',
      { t: pgTable('t', { n: text('n').$onUpdateFn(() => 'x') }) },
      '$onUpdateFn must be a function or constant exported from src/shared',
    ],
    [
      'identity columns',
      { t: pgTable('t', { n: integer('n').generatedAlwaysAsIdentity() }) },
      'generated/identity columns are not supported',
    ],
    [
      'non-btree indexes',
      { t: pgTable('t', { n: jsonb('n') }, (table) => [index('t_gin').using('gin', table.n)]) },
      'index method gin has no SQLite equivalent',
    ],
    [
      'unnamed indexes',
      { t: pgTable('t', { n: text('n') }, (table) => [index().on(table.n)]) },
      'indexes need an explicit name',
    ],
    [
      'expression indexes',
      {
        t: pgTable('t', { n: text('n') }, (table) => [index('t_lower').on(sql`lower(${table.n})`)]),
      },
      'expression indexes are not supported',
    ],
    [
      'parameterized SQL',
      {
        t: pgTable('t', { n: text('n') }, (table) => [
          index('t_p')
            .on(table.n)
            .where(sql`n = ${'x'}`),
        ]),
      },
      'SQL fragments with parameters are not supported',
    ],
    [
      'foreign keys to tables that are not exported',
      { t: pgTable('t', { n: uuid('n').references(() => parent.a) }) },
      'the referenced table must be exported too',
    ],
    ['circular foreign keys', { loopA, loopB }, 'circular foreign keys between tables'],
    [
      'unmapped column types',
      { t: pgTable('t', { n: inet('n') }) },
      'PgInet has no D1 mapping yet',
    ],
    [
      'composite foreign keys',
      {
        parent,
        t: pgTable('t', { a: uuid('a'), b: uuid('b') }, (table) => [
          foreignKey({ columns: [table.a, table.b], foreignColumns: [parent.a, parent.b] }),
        ]),
      },
      'composite foreign keys are not supported',
    ],
    ['no tables', { now }, 'no Postgres tables are exported'],
  ] as const)('refuses %s with a clear reason', (_case, schema, reason) => {
    expect(() => renderD1Schema(schema)).toThrow(UnsupportedSchemaError);
    expect(() => renderD1Schema(schema)).toThrow(reason);
  });

  test('renders a unique constraint without a name as an empty name', () => {
    const table = pgTable('t', { a: text('a') });
    const config = getTableConfig(table);
    const constraint = new UniqueConstraint(table, [config.columns[0]], false);
    vi.spyOn(constraint, 'getName').mockReturnValue(undefined);
    const imports = {
      builders: new Set<string>(),
      postgresTypes: false,
      shared: new Set<string>(),
      sql: false,
    };

    expect(
      renderExtras({ ...config, uniqueConstraints: [constraint] }, 't', () => 'table.a', imports),
    ).toStrictEqual(["unique('').on(table.a)"]);
  });
});
