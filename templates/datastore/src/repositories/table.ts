type Column<Row> = keyof Row & string;

interface TableRepository<Row, NewRow> {
  findBy: <K extends Column<Row>>(column: K, value: Row[K]) => Promise<Row | undefined>;
  insert: (row: NewRow) => Promise<Row>;
  list: (orderBy: readonly Column<Row>[], limit: number) => Promise<Row[]>;
  remove: <K extends Column<Row>>(column: K, value: Row[K]) => Promise<boolean>;
  update: <K extends Column<Row>>(
    column: K,
    value: Row[K],
    changes: Partial<NewRow>,
  ) => Promise<Row | undefined>;
}

export type { Column, TableRepository };
