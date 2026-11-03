import {
  type Column as DrizzleColumn,
  type SQL,
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  notInArray,
  sql,
} from 'drizzle-orm';

import type { Direction, Operators } from '../repositories/table';

type ColumnData = DrizzleColumn['_']['data'];

type ColumnMap = Readonly<Record<string, DrizzleColumn>>;

const equalTo = (
  columns: ColumnMap,
  where: Readonly<Partial<Record<string, ColumnData>>>,
): SQL | undefined =>
  and(
    ...Object.entries(where)
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => (value === null ? isNull(columns[name]) : eq(columns[name], value))),
  );

const operatorConditions = (column: DrizzleColumn, operators: Operators<ColumnData>): SQL[] => {
  const conditions: SQL[] = [];
  const add = <V>(value: V | undefined, build: (defined: V) => SQL) => {
    if (value !== undefined) {
      conditions.push(build(value));
    }
  };
  add(operators.eq, (value) => eq(column, value));
  add(operators.ne, (value) => ne(column, value));
  add(operators.gt, (value) => gt(column, value));
  add(operators.gte, (value) => gte(column, value));
  add(operators.lt, (value) => lt(column, value));
  add(operators.lte, (value) => lte(column, value));
  add(operators.in, (values) => inArray(column, [...values]));
  add(operators.notIn, (values) => notInArray(column, [...values]));
  add(operators.isNull, (wanted) => (wanted ? isNull(column) : isNotNull(column)));
  add(operators.like, (pattern: string) => like(sql`lower(${column})`, pattern.toLowerCase()));
  return conditions;
};

const matching = (
  columns: ColumnMap,
  filters: Readonly<Partial<Record<string, Operators<ColumnData>>>>,
): SQL | undefined =>
  and(
    ...Object.entries(filters).flatMap(([name, operators]) =>
      operators === undefined ? [] : operatorConditions(columns[name], operators),
    ),
  );

const ordering = (
  columns: ColumnMap,
  orderBy: readonly (string | { column: string; direction: Direction })[],
): SQL[] =>
  orderBy.map((entry) => {
    const { column, direction } =
      typeof entry === 'string' ? { column: entry, direction: 'asc' } : entry;
    return direction === 'desc' ? desc(columns[column]) : asc(columns[column]);
  });

const maxBoundParameters = 100;

const insertChunks = <Row>(rows: readonly Row[], columnCount: number): Row[][] => {
  const size = Math.max(1, Math.floor(maxBoundParameters / columnCount));
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
    rows.slice(index * size, (index + 1) * size),
  );
};

const requireCondition = (condition: SQL | undefined, method: string): SQL => {
  if (condition === undefined) {
    throw new Error(`${method} needs at least one where column; it never touches every row`);
  }
  return condition;
};

const singlePrimaryKey = <C extends DrizzleColumn>(columns: Readonly<Record<string, C>>): C => {
  const keys = Object.values(columns).filter((column) => column.primary);
  if (keys.length !== 1) {
    throw new Error(`Expected exactly one primary key column, found ${keys.length}`);
  }
  return keys[0];
};

export {
  equalTo,
  insertChunks,
  matching,
  maxBoundParameters,
  operatorConditions,
  ordering,
  requireCondition,
  singlePrimaryKey,
};
export type { ColumnData, ColumnMap };
