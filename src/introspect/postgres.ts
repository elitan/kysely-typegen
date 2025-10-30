import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { ColumnMetadata, DatabaseMetadata, EnumMetadata, TableMetadata } from './types';

type IntrospectionOptions = {
  schemas: string[];
};

type RawColumn = {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
};

type RawEnum = {
  schema_name: string;
  enum_name: string;
  enum_values: string | string[];
};

/**
 * Introspect a PostgreSQL database and return metadata
 */
export async function introspectDatabase(
  db: Kysely<any>,
  options: IntrospectionOptions,
): Promise<DatabaseMetadata> {
  const [tables, enums] = await Promise.all([
    introspectTables(db, options.schemas),
    introspectEnums(db, options.schemas),
  ]);

  return {
    tables,
    enums,
  };
}

async function introspectTables(db: Kysely<any>, schemas: string[]): Promise<TableMetadata[]> {
  const rawColumns = await sql<RawColumn>`
    SELECT
      c.table_schema,
      c.table_name,
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.column_default
    FROM information_schema.columns c
    INNER JOIN information_schema.tables t
      ON c.table_schema = t.table_schema
      AND c.table_name = t.table_name
    WHERE t.table_type = 'BASE TABLE'
      AND c.table_schema = ANY(${schemas})
    ORDER BY c.table_schema, c.table_name, c.ordinal_position
  `.execute(db);

  const tableMap = new Map<string, TableMetadata>();

  for (const row of rawColumns.rows) {
    const tableKey = `${row.table_schema}.${row.table_name}`;

    if (!tableMap.has(tableKey)) {
      tableMap.set(tableKey, {
        schema: row.table_schema,
        name: row.table_name,
        columns: [],
      });
    }

    const table = tableMap.get(tableKey);
    if (table) {
      table.columns.push({
        name: row.column_name,
        dataType: row.udt_name,
        isNullable: row.is_nullable === 'YES',
        isAutoIncrement: isAutoIncrementColumn(row),
        hasDefaultValue: row.column_default !== null,
      });
    }
  }

  return Array.from(tableMap.values());
}

async function introspectEnums(db: Kysely<any>, schemas: string[]): Promise<EnumMetadata[]> {
  const rawEnums = await sql<RawEnum>`
    SELECT
      n.nspname as schema_name,
      t.typname as enum_name,
      array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = ANY(${schemas})
    GROUP BY n.nspname, t.typname
    ORDER BY n.nspname, t.typname
  `.execute(db);

  return rawEnums.rows.map((row) => ({
    schema: row.schema_name,
    name: row.enum_name,
    values: parsePostgresArray(row.enum_values),
  }));
}

function isAutoIncrementColumn(column: RawColumn): boolean {
  if (!column.column_default) {
    return false;
  }

  // Check for serial columns (nextval)
  return column.column_default.includes('nextval');
}

function parsePostgresArray(value: string | string[]): string[] {
  // If it's already an array, return it
  if (Array.isArray(value)) {
    return value;
  }

  // Parse PostgreSQL array format: {value1,value2,value3}
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    return value.slice(1, -1).split(',');
  }

  return [value];
}
