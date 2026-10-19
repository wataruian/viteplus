import { eq, getColumns } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod';
import type { z } from 'zod';

import type { TableRepository } from '../repositories/table';
import type { D1Database } from './client';

const createD1Crud =
  (db: D1Database) =>
  <T extends SQLiteTable>(table: T) => {
    const base: SQLiteTable = table;
    const columns = getColumns(base);
    const select = createSelectSchema(table);
    const insert = createInsertSchema(table);
    const update = createUpdateSchema(table);
    const parseFirst = (rows: readonly unknown[]) =>
      rows.length === 0 ? undefined : select.parse(rows[0]);

    const repository: TableRepository<z.infer<typeof select>, z.input<typeof insert>> = {
      findBy: async (column, value) =>
        parseFirst(await db.select().from(base).where(eq(columns[column], value))),
      insert: async (row) => {
        const rows = await db.insert(base).values(insert.parse(row)).returning();
        return select.parse(rows[0]);
      },
      remove: async (column, value) => {
        const rows = await db.delete(base).where(eq(columns[column], value)).returning().all();
        return rows.length > 0;
      },
      update: async (column, value, changes) =>
        parseFirst(
          await db
            .update(base)
            .set(update.parse(changes))
            .where(eq(columns[column], value))
            .returning(),
        ),
    };
    return repository;
  };

export { createD1Crud };
