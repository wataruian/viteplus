import { type SQL, asc, count, eq, getColumns, inArray } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod';
import type { z } from 'zod';

import type { Page, TableRepository } from '../repositories/table';
import { first } from '../shared';
import {
  equalTo,
  insertChunks,
  matching,
  ordering,
  requireCondition,
  singlePrimaryKey,
} from '../shared/where';
import type { D1Database } from './client';

const createD1Crud =
  (db: D1Database) =>
  <T extends SQLiteTable>(table: T) => {
    const base: SQLiteTable = table;
    const columns = getColumns(base);
    const columnCount = Object.keys(columns).length;
    const primaryKey = singlePrimaryKey(columns);
    const select = createSelectSchema(table);
    const insert = createInsertSchema(table);
    const update = createUpdateSchema(table);
    type Row = z.infer<typeof select>;
    type NewRow = z.input<typeof insert>;
    const parseRows = (rows: readonly unknown[]) => rows.map((row) => select.parse(row));
    const selectRows = async (where: SQL | undefined, { limit, offset = 0, orderBy }: Page<Row>) =>
      parseRows(
        await db
          .select()
          .from(base)
          .where(where)
          .orderBy(...ordering(columns, orderBy))
          .limit(limit)
          .offset(offset),
      );
    const firstMatch = (where: SQL) =>
      inArray(
        primaryKey,
        db.select({ key: primaryKey }).from(base).where(where).orderBy(asc(primaryKey)).limit(1),
      );
    const deleteWhere = async (where: SQL) =>
      parseRows(await db.delete(base).where(where).returning().execute());
    const updateWhere = async (where: SQL, changes: Partial<NewRow>) =>
      parseRows(await db.update(base).set(update.parse(changes)).where(where).returning());
    const insertRows = async (rows: readonly NewRow[]) =>
      parseRows(
        await db
          .insert(base)
          .values(rows.map((row) => insert.parse(row)))
          .returning(),
      );

    const repository: TableRepository<Row, NewRow> = {
      count: async (filters = {}) => {
        const [result] = await db
          .select({ total: count() })
          .from(base)
          .where(matching(columns, filters));
        return result.total;
      },
      findBy: async (column, value) =>
        first(parseRows(await db.select().from(base).where(eq(columns[column], value)).limit(1))),
      findMany: async (where, page) => await selectRows(equalTo(columns, where), page),
      insert: async (row) => {
        const [inserted] = await insertRows([row]);
        return inserted;
      },
      insertMany: async (rows) => {
        const inserted: Row[] = [];
        for (const chunk of insertChunks(rows, columnCount)) {
          inserted.push(...(await insertRows(chunk)));
        }
        return inserted;
      },
      list: async (page) => await selectRows(undefined, page),
      removeBy: async (column, value) =>
        first(await deleteWhere(firstMatch(eq(columns[column], value)))),
      removeMany: async (where) => {
        const removed = await deleteWhere(requireCondition(equalTo(columns, where), 'removeMany'));
        return removed.length;
      },
      search: async (filters, page) => await selectRows(matching(columns, filters), page),
      updateBy: async (column, value, changes) =>
        first(await updateWhere(firstMatch(eq(columns[column], value)), changes)),
      updateMany: async (where, changes) =>
        await updateWhere(requireCondition(equalTo(columns, where), 'updateMany'), changes),
      upsert: async (row, { set, target }) => {
        const [upserted] = parseRows(
          await db
            .insert(base)
            .values(insert.parse(row))
            .onConflictDoUpdate({ set: update.parse(set), target: columns[target] })
            .returning(),
        );
        return upserted;
      },
    };
    return repository;
  };

export { createD1Crud };
