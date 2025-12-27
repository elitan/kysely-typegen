import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { ColumnMetadata, DatabaseMetadata, TableMetadata } from '@/introspect/types';
import type { IntrospectOptions } from '@/dialects/types';

type RawTableInfo = {
  name: string;
  type: string;
};

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
  const [baseTables, views] = await Promise.all([
    introspectTables(db),
    introspectViews(db),
  ]);

  return {
    tables: [...baseTables, ...views],
    enums: [],
  };
}

async function introspectTables(db: Kysely<any>): Promise<TableMetadata[]> {
  const rawTables = await sql<RawTableInfo>`
    SELECT name, type FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `.execute(db);

  const tables: TableMetadata[] = [];

  for (const rawTable of rawTables.rows) {
    const columns = await introspectColumns(db, rawTable.name, false);
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
): Promise<ColumnMetadata[]> {
  const rawColumns = await sql<RawColumnInfo>`
    PRAGMA table_info(${sql.raw(`'${tableName}'`)})
  `.execute(db);

  return rawColumns.rows.map((col) => {
    const isIntegerPk = col.pk === 1 && col.type.toUpperCase() === 'INTEGER';
    const isAutoIncrement = !isView && isIntegerPk;

    return {
      name: col.name,
      dataType: normalizeDataType(col.type),
      dataTypeSchema: 'main',
      isNullable: col.notnull === 0 && col.pk === 0,
      isAutoIncrement,
      hasDefaultValue: col.dflt_value !== null || isAutoIncrement,
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
