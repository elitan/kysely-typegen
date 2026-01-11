import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { CheckConstraintValues, ColumnMetadata, DatabaseMetadata, TableMetadata } from '@/introspect/types';
import type { IntrospectOptions } from '@/dialects/types';
import { parseMssqlCheckConstraint } from '@/utils/check-constraint-parser';

type RawColumn = {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
  COLUMN_DEFAULT: string | null;
  IS_IDENTITY: number;
  IS_COMPUTED: number;
};

type RawCheckConstraint = {
  schema_name: string;
  table_name: string;
  column_name: string | null;
  check_definition: string;
};

type CheckConstraintMap = Map<string, CheckConstraintValues>;

export async function introspectMssql(
  db: Kysely<any>,
  options: IntrospectOptions,
): Promise<DatabaseMetadata> {
  const [baseTables, views, checkConstraints] = await Promise.all([
    introspectTables(db, options.schemas),
    introspectViews(db, options.schemas),
    introspectCheckConstraints(db, options.schemas),
  ]);

  const tables = [...baseTables, ...views].map((table) => ({
    ...table,
    columns: table.columns.map((column) => {
      const key = `${table.schema}.${table.name}.${column.name}`;
      const checkConstraint = checkConstraints.get(key);
      return {
        ...column,
        ...(checkConstraint && { checkConstraint }),
      };
    }),
  }));

  return {
    tables,
    enums: [],
  };
}

async function introspectTables(db: Kysely<any>, schemas: string[]): Promise<TableMetadata[]> {
  const rawColumns = await sql<RawColumn>`
    SELECT
      c.TABLE_SCHEMA,
      c.TABLE_NAME,
      c.COLUMN_NAME,
      c.DATA_TYPE,
      c.IS_NULLABLE,
      c.COLUMN_DEFAULT,
      COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY,
      COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsComputed') AS IS_COMPUTED
    FROM INFORMATION_SCHEMA.COLUMNS c
    INNER JOIN INFORMATION_SCHEMA.TABLES t
      ON c.TABLE_SCHEMA = t.TABLE_SCHEMA
      AND c.TABLE_NAME = t.TABLE_NAME
    WHERE t.TABLE_TYPE = 'BASE TABLE'
      AND c.TABLE_SCHEMA IN (${sql.join(schemas.map(s => sql`${s}`))})
    ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION
  `.execute(db);

  return buildTableMetadata(rawColumns.rows, false);
}

async function introspectViews(db: Kysely<any>, schemas: string[]): Promise<TableMetadata[]> {
  const rawColumns = await sql<RawColumn>`
    SELECT
      c.TABLE_SCHEMA,
      c.TABLE_NAME,
      c.COLUMN_NAME,
      c.DATA_TYPE,
      c.IS_NULLABLE,
      c.COLUMN_DEFAULT,
      0 AS IS_IDENTITY,
      0 AS IS_COMPUTED
    FROM INFORMATION_SCHEMA.COLUMNS c
    INNER JOIN INFORMATION_SCHEMA.VIEWS v
      ON c.TABLE_SCHEMA = v.TABLE_SCHEMA
      AND c.TABLE_NAME = v.TABLE_NAME
    WHERE c.TABLE_SCHEMA IN (${sql.join(schemas.map(s => sql`${s}`))})
    ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION
  `.execute(db);

  return buildTableMetadata(rawColumns.rows, true);
}

function buildTableMetadata(rows: RawColumn[], isView: boolean): TableMetadata[] {
  const tableMap = new Map<string, TableMetadata>();

  for (const row of rows) {
    const tableKey = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;

    if (!tableMap.has(tableKey)) {
      tableMap.set(tableKey, {
        schema: row.TABLE_SCHEMA,
        name: row.TABLE_NAME,
        columns: [],
        ...(isView && { isView: true }),
      });
    }

    const table = tableMap.get(tableKey);
    if (table) {
      const isAutoIncrement = row.IS_IDENTITY === 1;
      const isComputed = row.IS_COMPUTED === 1;

      const columnMetadata: ColumnMetadata = {
        name: row.COLUMN_NAME,
        dataType: row.DATA_TYPE.toLowerCase(),
        dataTypeSchema: row.TABLE_SCHEMA,
        isNullable: row.IS_NULLABLE === 'YES',
        isAutoIncrement: isView ? false : (isAutoIncrement || isComputed),
        hasDefaultValue: row.COLUMN_DEFAULT !== null || isAutoIncrement || isComputed,
      };

      table.columns.push(columnMetadata);
    }
  }

  return Array.from(tableMap.values());
}

async function introspectCheckConstraints(
  db: Kysely<any>,
  schemas: string[]
): Promise<CheckConstraintMap> {
  const rawConstraints = await sql<RawCheckConstraint>`
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      c.name AS column_name,
      cc.definition AS check_definition
    FROM sys.check_constraints cc
    JOIN sys.tables t ON cc.parent_object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    LEFT JOIN sys.columns c ON cc.parent_column_id = c.column_id AND c.object_id = t.object_id
    WHERE cc.is_disabled = 0
      AND cc.parent_column_id > 0
      AND s.name IN (${sql.join(schemas.map(s => sql`${s}`))})
  `.execute(db);

  const constraintMap: CheckConstraintMap = new Map();

  for (const row of rawConstraints.rows) {
    if (!row.column_name) continue;

    const key = `${row.schema_name}.${row.table_name}.${row.column_name}`;
    if (constraintMap.has(key)) continue;

    const parsed = parseMssqlCheckConstraint(row.check_definition);
    if (parsed) {
      constraintMap.set(key, parsed);
    }
  }

  return constraintMap;
}
