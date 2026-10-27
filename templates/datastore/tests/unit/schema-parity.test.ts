import { is } from 'drizzle-orm';
import { PgTable, getTableConfig as getPostgresTableConfig } from 'drizzle-orm/pg-core';
import { SQLiteTable, getTableConfig as getSqliteTableConfig } from 'drizzle-orm/sqlite-core';
import { describe, expect, expectTypeOf, test } from 'vite-plus/test';

import * as d1 from '../../src/d1/schema';
import * as postgres from '../../src/postgres/schema';

interface ColumnShape {
  hasDefault: boolean;
  name: string;
  notNull: boolean;
  primary: boolean;
  unique: boolean;
}

interface TableShape {
  checks: string[];
  columns: ColumnShape[];
  foreignKeys: string[];
  indexes: { columns: string[]; name: string; unique: boolean }[];
  name: string;
}

type AnyConfig =
  | ReturnType<typeof getPostgresTableConfig>
  | ReturnType<typeof getSqliteTableConfig>;

const shapeOf = ({ checks, columns, foreignKeys, indexes, name }: AnyConfig): TableShape => ({
  checks: checks.map((check) => check.name).toSorted(),
  columns: columns
    .map((column) => ({
      hasDefault: column.hasDefault,
      name: column.name,
      notNull: column.notNull,
      primary: column.primary,
      unique: column.isUnique,
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name)),
  foreignKeys: foreignKeys.map((foreignKey) => foreignKey.getName()).toSorted(),
  indexes: indexes
    .map(({ config }) => ({
      columns: config.columns.map((column) => ('name' in column ? (column.name ?? '') : '')),
      name: config.name ?? '',
      unique: config.unique,
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name)),
  name,
});

const postgresTables = Object.entries(postgres).flatMap(([name, value]) =>
  is(value, PgTable) ? [[name, value] as const] : [],
);
const d1Tables = new Map(
  Object.entries(d1).flatMap(([name, value]) =>
    is(value, SQLiteTable) ? [[name, value] as const] : [],
  ),
);

type TableKey<Module> = {
  [K in keyof Module]: Module[K] extends { $inferSelect: object } ? K : never;
}[keyof Module];

type Rows<Module, Kind extends '$inferSelect' | '$inferInsert'> = {
  [K in TableKey<Module>]: Module[K] extends Record<Kind, object> ? Module[K][Kind] : never;
};

describe('schema parity (postgres vs d1)', () => {
  test('both dialects export the same tables', () => {
    expect(postgresTables.map(([name]) => name).toSorted()).toStrictEqual(
      [...d1Tables.keys()].toSorted(),
    );
    expect(postgresTables.length).toBeGreaterThan(0);
  });

  test.each(postgresTables)('%s has the same columns, constraints and indexes', (name, pg) => {
    const sqlite = d1Tables.get(name);
    if (!sqlite) {
      throw new Error(`d1 schema has no "${name}": run \`vp run db:generate\``);
    }
    expect(shapeOf(getPostgresTableConfig(pg))).toStrictEqual(
      shapeOf(getSqliteTableConfig(sqlite)),
    );
  });

  test('row types are identical for every table, so app code can use one set of types', () => {
    expectTypeOf<Rows<typeof postgres, '$inferSelect'>>().toEqualTypeOf<
      Rows<typeof d1, '$inferSelect'>
    >();
    expectTypeOf<Rows<typeof postgres, '$inferInsert'>>().toEqualTypeOf<
      Rows<typeof d1, '$inferInsert'>
    >();
  });
});
