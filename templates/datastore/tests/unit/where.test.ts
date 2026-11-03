import { getColumns } from 'drizzle-orm';
import { pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { describe, expect, test } from 'vite-plus/test';

import { requireCondition, singlePrimaryKey } from '../../src/shared/where';

describe('singlePrimaryKey', () => {
  test('returns the one primary key column', () => {
    const table = pgTable('single', { id: text('id').primaryKey(), name: text('name') });

    expect(singlePrimaryKey(getColumns(table))).toBe(table.id);
  });

  test('rejects a table without a single-column primary key', () => {
    const keyless = pgTable('keyless', { name: text('name') });
    const composite = pgTable('composite', { a: text('a'), b: text('b') }, (table) => [
      primaryKey({ columns: [table.a, table.b] }),
    ]);

    expect(() => singlePrimaryKey(getColumns(keyless))).toThrow(
      'Expected exactly one primary key column, found 0',
    );
    expect(() => singlePrimaryKey(getColumns(composite))).toThrow(
      'Expected exactly one primary key column, found 0',
    );
  });
});

describe('requireCondition', () => {
  test('names the method that refused to touch every row', () => {
    expect(() => requireCondition(undefined, 'removeMany')).toThrow(
      'removeMany needs at least one where column; it never touches every row',
    );
  });
});
