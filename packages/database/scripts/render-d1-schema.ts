import { SQL, getColumns, is } from 'drizzle-orm';
import { PgColumn, PgDialect, PgTable, getTableConfig } from 'drizzle-orm/pg-core';

import * as shared from '../src/shared';

class UnsupportedSchemaError extends Error {
  public constructor(where: string, reason: string) {
    super(`${where}: ${reason}`);
    this.name = 'UnsupportedSchemaError';
  }
}

type IndexColumn = ReturnType<
  typeof getTableConfig
>['indexes'][number]['config']['columns'][number];

interface Imports {
  builders: Set<string>;
  shared: Set<string>;
  sql: boolean;
  postgresTypes: boolean;
}

const dialect = new PgDialect();

const sharedNames = new Map<object, string>(
  Object.entries(shared).flatMap(([name, value]) =>
    typeof value === 'object' || typeof value === 'function' ? [[value, name] as const] : [],
  ),
);

const columnName = (column: PgColumn | IndexColumn) => {
  if (is(column, PgColumn)) {
    return column.name;
  }
  return is(column, SQL) || !('name' in column) ? undefined : column.name;
};

const sortedList = (values: Set<string>) =>
  [...values].toSorted((a, b) => a.localeCompare(b)).join(', ');

const quote = (value: string) =>
  `'${value.replaceAll('\\', String.raw`\\`).replaceAll("'", String.raw`\'`)}'`;

const sharedReference = (value: object, imports: Imports, where: string, what: string) => {
  const name = sharedNames.get(value);
  if (name === undefined) {
    throw new UnsupportedSchemaError(
      where,
      `${what} must be a function or constant exported from src/shared, so both dialects share it`,
    );
  }
  imports.shared.add(name);
  return name;
};

const sqlText = (fragment: SQL, where: string) => {
  const { params, sql } = dialect.sqlToQuery(fragment);
  if (params.length > 0) {
    throw new UnsupportedSchemaError(where, 'SQL fragments with parameters are not supported');
  }
  return sql;
};

const enumOption = (column: PgColumn, imports: Imports, where: string) =>
  column.enumValues === undefined
    ? ''
    : `, { enum: ${sharedNames.get(column.enumValues) === undefined ? `[${column.enumValues.map((value) => quote(value)).join(', ')}]` : sharedReference(column.enumValues, imports, where, 'enum values')} }`;

const unsupportedTypes: Partial<Record<string, string>> = {
  PgBigInt64: "bigint mode 'bigint' has no D1 equivalent; use { mode: 'number' }",
  PgDateString: "date columns have no D1 equivalent; use timestamp(…, { mode: 'date' })",
  PgNumeric: 'numeric has no exact SQLite equivalent; store integer cents (integer) or use real',
  PgSerial: 'serial ids are not portable; use a text/uuid id with .$defaultFn(newId)',
  PgTimestampString: "timestamp mode 'string' is not supported; use { mode: 'date' }",
};

type BuilderRender = (column: PgColumn, name: string, imports: Imports, where: string) => string;

const textBuilder: BuilderRender = (column, name, imports, where) => {
  imports.builders.add('text');
  return `text(${name}${enumOption(column, imports, where)})`;
};

const integerBuilder =
  (options = ''): BuilderRender =>
  (_column, name, imports) => {
    imports.builders.add('integer');
    return `integer(${name}${options})`;
  };

const realBuilder: BuilderRender = (_column, name, imports) => {
  imports.builders.add('real');
  return `real(${name})`;
};

const builders: Partial<Record<string, BuilderRender>> = {
  PgBigInt53: integerBuilder(),
  PgBoolean: integerBuilder(", { mode: 'boolean' }"),
  PgChar: textBuilder,
  PgDoublePrecision: realBuilder,
  PgEnumColumn: textBuilder,
  PgInteger: integerBuilder(),
  PgReal: realBuilder,
  PgSmallInt: integerBuilder(),
  PgText: textBuilder,
  PgTimestamp: integerBuilder(", { mode: 'timestamp_ms' }"),
  PgUUID: textBuilder,
  PgVarchar: textBuilder,
};

const jsonColumnTypes = new Set(['PgJson', 'PgJsonb']);

const columnBuilder = (
  column: PgColumn,
  tableExport: string,
  key: string,
  imports: Imports,
  where: string,
) => {
  const name = quote(column.name);
  if (jsonColumnTypes.has(column.columnType)) {
    imports.builders.add('text');
    imports.postgresTypes = true;
    return `text(${name}, { mode: 'json' }).$type<(typeof postgres.${tableExport}.${key})['_']['data']>()`;
  }
  const builder = builders[column.columnType];
  if (!builder) {
    throw new UnsupportedSchemaError(
      where,
      unsupportedTypes[column.columnType] ?? `${column.columnType} has no D1 mapping yet`,
    );
  }
  return builder(column, name, imports, where);
};

const renderColumn = (
  column: PgColumn,
  tableExport: string,
  key: string,
  references: string,
  imports: Imports,
) => {
  const where = `${tableExport}.${key}`;
  if (column.dimensions > 0) {
    throw new UnsupportedSchemaError(where, 'arrays have no SQLite equivalent; use jsonb');
  }
  if (column.generated !== undefined || column.generatedIdentity !== undefined) {
    throw new UnsupportedSchemaError(where, 'generated/identity columns are not supported');
  }

  const parts = [columnBuilder(column, tableExport, key, imports, where)];
  if (column.primary) {
    parts.push('.primaryKey()');
  } else if (column.notNull) {
    parts.push('.notNull()');
  }
  if (column.isUnique && !column.primary) {
    parts.push(
      column.uniqueName === undefined ? '.unique()' : `.unique(${quote(column.uniqueName)})`,
    );
  }
  if (column.default !== undefined) {
    if (
      is(column.default, SQL) ||
      !['string', 'number', 'boolean'].includes(typeof column.default)
    ) {
      throw new UnsupportedSchemaError(
        where,
        'SQL/object defaults are not portable; use .$defaultFn() with a src/shared function',
      );
    }
    parts.push(`.default(${JSON.stringify(column.default)})`);
  }
  if (column.defaultFn !== undefined) {
    parts.push(`.$defaultFn(${sharedReference(column.defaultFn, imports, where, '$defaultFn')})`);
  }
  if (column.onUpdateFn !== undefined) {
    parts.push(
      `.$onUpdateFn(${sharedReference(column.onUpdateFn, imports, where, '$onUpdateFn')})`,
    );
  }
  return `${parts.join('')}${references}`;
};

type TableConfig = ReturnType<typeof getTableConfig>;
type ForeignKey = TableConfig['foreignKeys'][number];
type ColumnRef = (column: PgColumn | IndexColumn, where: string) => string;

const referentialAction = (label: string, action: ForeignKey['onDelete']) =>
  action === undefined || action === 'no action' ? [] : [`${label}: ${quote(action)}`];

const renderReference = (
  foreignKey: ForeignKey,
  tableExport: string,
  exportNames: ReadonlyMap<PgTable, string>,
) => {
  const where = `${tableExport} foreign key ${foreignKey.getName()}`;
  const { columns, foreignColumns, foreignTable } = foreignKey.reference();
  if (columns.length !== 1 || foreignColumns.length !== 1) {
    throw new UnsupportedSchemaError(where, 'composite foreign keys are not supported');
  }
  const [column] = columns;
  const [foreignColumn] = foreignColumns;
  const foreignExport = exportNames.get(foreignTable);
  const foreignKeyName = Object.entries(getColumns(foreignTable)).find(
    ([, candidate]) => candidate === foreignColumn,
  )?.[0];
  if (foreignExport === undefined || foreignKeyName === undefined) {
    throw new UnsupportedSchemaError(where, 'the referenced table must be exported too');
  }
  const actions = [
    ...referentialAction('onDelete', foreignKey.onDelete),
    ...referentialAction('onUpdate', foreignKey.onUpdate),
  ];
  const options = actions.length > 0 ? `, { ${actions.join(', ')} }` : '';
  return [column, `.references(() => ${foreignExport}.${foreignKeyName}${options})`] as const;
};

const renderIndex = (
  index: TableConfig['indexes'][number]['config'],
  tableExport: string,
  columnRef: ColumnRef,
  imports: Imports,
) => {
  const where = `${tableExport} index ${index.name ?? '(unnamed)'}`;
  if (index.name === undefined) {
    throw new UnsupportedSchemaError(where, 'indexes need an explicit name');
  }
  if (index.method !== 'btree') {
    throw new UnsupportedSchemaError(
      where,
      `index method ${index.method} has no SQLite equivalent`,
    );
  }
  const builder = index.unique ? 'uniqueIndex' : 'index';
  imports.builders.add(builder);
  const on = index.columns.map((column) => columnRef(column, where)).join(', ');
  const whereClause =
    index.where === undefined ? '' : `.where(sql.raw(${quote(sqlText(index.where, where))}))`;
  imports.sql ||= whereClause !== '';
  return `${builder}(${quote(index.name)}).on(${on})${whereClause}`;
};

const renderExtras = (
  config: TableConfig,
  tableExport: string,
  columnRef: ColumnRef,
  imports: Imports,
) => {
  const checks = config.checks.map(({ name, value }) => {
    imports.builders.add('check');
    imports.sql = true;
    return `check(${quote(name)}, sql.raw(${quote(sqlText(value, `${tableExport} check ${name}`))}))`;
  });
  const indexes = config.indexes.map(({ config: index }) =>
    renderIndex(index, tableExport, columnRef, imports),
  );
  const uniques = config.uniqueConstraints.map((unique) => {
    const uniqueName = unique.getName() ?? '';
    const where = `${tableExport} unique ${uniqueName}`;
    imports.builders.add('unique');
    const on = unique.columns.map((column) => columnRef(column, where)).join(', ');
    return `unique(${quote(uniqueName)}).on(${on})`;
  });
  const primaryKeys = config.primaryKeys.map((primaryKey) => {
    imports.builders.add('primaryKey');
    const where = `${tableExport} primary key`;
    const columns = primaryKey.columns.map((column) => columnRef(column, where)).join(', ');
    return `primaryKey({ columns: [${columns}] })`;
  });
  return [...checks, ...indexes, ...uniques, ...primaryKeys];
};

const renderTable = (
  table: PgTable,
  tableExport: string,
  exportNames: ReadonlyMap<PgTable, string>,
  imports: Imports,
) => {
  const config = getTableConfig(table);
  const keyByName = new Map(
    Object.entries(getColumns(table)).map(([key, column]) => [column.name, key]),
  );
  const columnRef: ColumnRef = (column, where) => {
    const key = keyByName.get(columnName(column) ?? '');
    if (key === undefined) {
      throw new UnsupportedSchemaError(where, 'expression indexes are not supported');
    }
    return `table.${key}`;
  };

  const references = new Map<PgColumn, string>(
    config.foreignKeys.map((foreignKey) => renderReference(foreignKey, tableExport, exportNames)),
  );
  const columns = Object.entries(getColumns(table))
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, column]) =>
        `    ${key}: ${renderColumn(column, tableExport, key, references.get(column) ?? '', imports)},`,
    );
  const extras = renderExtras(config, tableExport, columnRef, imports);

  imports.builders.add('sqliteTable');
  const body = `{\n${columns.join('\n')}\n  }`;
  const extraConfig =
    extras.length === 0
      ? ''
      : `,\n  (table) => [\n${extras.map((extra) => `    ${extra},`).join('\n')}\n  ]`;
  return `const ${tableExport} = sqliteTable(\n  ${quote(config.name)},\n  ${body}${extraConfig},\n);`;
};

const orderByDependencies = (tables: readonly (readonly [string, PgTable])[]) => {
  const byTable = new Map(tables.map(([name, table]) => [table, name]));
  const dependencies = new Map(
    tables.map(([name, table]) => [
      name,
      new Set(
        getTableConfig(table).foreignKeys.flatMap((foreignKey) => {
          const target = byTable.get(foreignKey.reference().foreignTable);
          return target === undefined || target === name ? [] : [target];
        }),
      ),
    ]),
  );
  const ordered: string[] = [];
  const visit = (name: string, path: readonly string[]) => {
    if (ordered.includes(name)) {
      return;
    }
    if (path.includes(name)) {
      throw new UnsupportedSchemaError(
        [...path, name].join(' → '),
        'circular foreign keys between tables are not supported',
      );
    }
    for (const target of [...(dependencies.get(name) ?? [])].toSorted((a, b) =>
      a.localeCompare(b),
    )) {
      visit(target, [...path, name]);
    }
    ordered.push(name);
  };
  for (const [name] of tables) {
    visit(name, []);
  }
  return ordered.flatMap((name) => tables.filter(([candidate]) => candidate === name));
};

const renderD1Schema = (schema: Readonly<Record<string, object>>) => {
  const tables = Object.entries(schema)
    .flatMap(([name, value]) => (is(value, PgTable) ? [[name, value] as const] : []))
    .toSorted(([a], [b]) => a.localeCompare(b));
  if (tables.length === 0) {
    throw new UnsupportedSchemaError('schema', 'no Postgres tables are exported');
  }
  const exportNames = new Map<PgTable, string>(tables.map(([name, table]) => [table, name]));
  const declarationOrder = orderByDependencies(tables);
  const imports: Imports = {
    builders: new Set(),
    postgresTypes: false,
    shared: new Set(),
    sql: false,
  };
  const rendered = declarationOrder.map(([name, table]) =>
    renderTable(table, name, exportNames, imports),
  );

  const header = [
    ...(imports.sql ? ["import { sql } from 'drizzle-orm';"] : []),
    `import { ${sortedList(imports.builders)} } from 'drizzle-orm/sqlite-core';`,
    '',
    ...(imports.postgresTypes ? ["import type * as postgres from '../postgres/schema';"] : []),
    ...(imports.shared.size > 0
      ? [`import { ${sortedList(imports.shared)} } from '../shared';`]
      : []),
  ];
  return `${header.join('\n')}\n\n${rendered.join('\n\n')}\n\nexport { ${tables.map(([name]) => name).join(', ')} };\n`;
};

export {
  UnsupportedSchemaError,
  builders,
  columnBuilder,
  columnName,
  dialect,
  enumOption,
  integerBuilder,
  orderByDependencies,
  quote,
  realBuilder,
  referentialAction,
  renderColumn,
  renderD1Schema,
  renderExtras,
  renderIndex,
  renderReference,
  renderTable,
  sharedReference,
  sortedList,
  sqlText,
  textBuilder,
  unsupportedTypes,
};
export type { BuilderRender, ColumnRef, ForeignKey, Imports, IndexColumn, TableConfig };
