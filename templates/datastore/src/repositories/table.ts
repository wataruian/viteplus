type Column<Row> = keyof Row & string;

type Direction = 'asc' | 'desc';

type OrderBy<Row> = readonly (Column<Row> | { column: Column<Row>; direction: Direction })[];

interface Page<Row> {
  orderBy: OrderBy<Row>;
  limit: number;
  offset?: number | undefined;
}

type Where<Row> = { [K in Column<Row>]?: Row[K] | undefined };

interface Operators<Value> {
  eq?: Value | undefined;
  ne?: Value | undefined;
  gt?: Value | undefined;
  gte?: Value | undefined;
  lt?: Value | undefined;
  lte?: Value | undefined;
  in?: readonly Value[] | undefined;
  notIn?: readonly Value[] | undefined;
  isNull?: boolean | undefined;
  like?: (Value extends string ? string : never) | undefined;
}

type Filters<Row> = { [K in Column<Row>]?: Operators<NonNullable<Row[K]>> | undefined };

interface Upsert<Row, NewRow> {
  target: Column<Row>;
  set: Partial<NewRow>;
}

interface TableRepository<Row, NewRow> {
  count: (filters?: Filters<Row>) => Promise<number>;
  findBy: <K extends Column<Row>>(column: K, value: Row[K]) => Promise<Row | undefined>;
  findMany: (where: Where<Row>, page: Page<Row>) => Promise<Row[]>;
  insert: (row: NewRow) => Promise<Row>;
  insertMany: (rows: readonly NewRow[]) => Promise<Row[]>;
  list: (page: Page<Row>) => Promise<Row[]>;
  removeBy: <K extends Column<Row>>(column: K, value: Row[K]) => Promise<Row | undefined>;
  removeMany: (where: Where<Row>) => Promise<number>;
  search: (filters: Filters<Row>, page: Page<Row>) => Promise<Row[]>;
  updateBy: <K extends Column<Row>>(
    column: K,
    value: Row[K],
    changes: Partial<NewRow>,
  ) => Promise<Row | undefined>;
  updateMany: (where: Where<Row>, changes: Partial<NewRow>) => Promise<Row[]>;
  upsert: (row: NewRow, conflict: Upsert<Row, NewRow>) => Promise<Row>;
}

export type {
  Column,
  Direction,
  Filters,
  Operators,
  OrderBy,
  Page,
  TableRepository,
  Upsert,
  Where,
};
