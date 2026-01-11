import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type {
  CheckConstraintValues,
  ColumnMetadata,
  DatabaseMetadata,
  TableMetadata,
} from '@/introspect/types';
import type { IntrospectOptions } from '@/dialects/types';
import { parseSqliteTableDDL } from '@/utils/sqlite-ddl-parser';
import { parseSqliteCheckConstraint } from '@/utils/check-constraint-parser';

type RawTableInfo = {
  name: string;
  type: string;
};

type RawTableDDL = {
  name: string;
  sql: string;
};

type CheckConstraintMap = Map<string, CheckConstraintValues>;

type RawColumnInfo = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

export async function introspectSqlite(
  db: Kysely<any>,
  _options: IntrospectOptions,
): Promise<DatabaseMetadata> {
  const checkConstraints = await introspectCheckConstraints(db);

  const [baseTables, views] = await Promise.all([
    introspectTables(db, checkConstraints),
    introspectViews(db),
  ]);

  return {
    tables: [...baseTables, ...views],
    enums: [],
  };
}

async function introspectTables(
  db: Kysely<any>,
  checkConstraints: CheckConstraintMap,
): Promise<TableMetadata[]> {
  const rawTables = await sql<RawTableInfo>`
    SELECT name, type FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `.execute(db);

  const tables: TableMetadata[] = [];

  for (const rawTable of rawTables.rows) {
    const columns = await introspectColumns(db, rawTable.name, false, checkConstraints);
    tables.push({
      schema: 'main',
      name: rawTable.name,
      columns,
    });
  }

  return tables;
}

async function introspectViews(db: Kysely<any>): Promise<TableMetadata[]> {
  const rawViews = await sql<RawTableInfo>`
    SELECT name, type FROM sqlite_master
    WHERE type = 'view'
    ORDER BY name
  `.execute(db);

  const tables: TableMetadata[] = [];

  for (const rawView of rawViews.rows) {
    const columns = await introspectColumns(db, rawView.name, true);
    tables.push({
      schema: 'main',
      name: rawView.name,
      columns,
      isView: true,
    });
  }

  return tables;
}

async function introspectColumns(
  db: Kysely<any>,
  tableName: string,
  isView: boolean,
  checkConstraints?: CheckConstraintMap,
): Promise<ColumnMetadata[]> {
  const rawColumns = await sql<RawColumnInfo>`
    PRAGMA table_info(${sql.raw(`'${tableName}'`)})
  `.execute(db);

  return rawColumns.rows.map((col) => {
    const isIntegerPk = col.pk === 1 && col.type.toUpperCase() === 'INTEGER';
    const isAutoIncrement = !isView && isIntegerPk;
    const constraintKey = `${tableName}.${col.name}`;
    const checkConstraint = checkConstraints?.get(constraintKey);

    return {
      name: col.name,
      dataType: normalizeDataType(col.type),
      dataTypeSchema: 'main',
      isNullable: col.notnull === 0 && col.pk === 0,
      isAutoIncrement,
      hasDefaultValue: col.dflt_value !== null || isAutoIncrement,
      ...(checkConstraint && { checkConstraint }),
    };
  });
}

function normalizeDataType(type: string): string {
  const lowerType = type.toLowerCase();

  if (lowerType === '' || lowerType === 'blob') {
    return 'blob';
  }

  return lowerType;
}

async function introspectCheckConstraints(db: Kysely<any>): Promise<CheckConstraintMap> {
  const result = await sql<RawTableDDL>`
    SELECT name, sql FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND sql IS NOT NULL
  `.execute(db);

  const constraints: CheckConstraintMap = new Map();

  for (const row of result.rows) {
    const parsed = parseSqliteTableDDL(row.sql);
    for (const { columnName, definition } of parsed) {
      const constraint = parseSqliteCheckConstraint(definition);
      if (constraint) {
        const key = `${row.name}.${columnName}`;
        constraints.set(key, constraint);
      }
    }
  }

  return constraints;
}
