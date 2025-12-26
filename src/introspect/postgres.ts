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
  udt_schema: string;
  is_nullable: string;
  is_identity: string;
  column_default: string | null;
  column_comment: string | null;
};

type RawEnum = {
  schema_name: string;
  enum_name: string;
  enum_values: string | string[];
};

type DomainInfo = {
  type_name: string;
  type_schema: string;
  root_type: string;
};

type PartitionInfo = {
  schema: string;
  name: string;
};

/**
 * Introspect a PostgreSQL database and return metadata
 */
export async function introspectDatabase(
  db: Kysely<any>,
  options: IntrospectionOptions,
): Promise<DatabaseMetadata> {
  const [domains, partitions, baseTables, regularViews, materializedViews, enums] = await Promise.all([
    introspectDomains(db),
    introspectPartitions(db),
    introspectTables(db, options.schemas),
    introspectViews(db, options.schemas),
    introspectMaterializedViews(db, options.schemas),
    introspectEnums(db, options.schemas),
  ]);

  // Resolve domain types to their root types and mark partitions
  const tables = [...baseTables, ...regularViews, ...materializedViews].map((table) => {
    const isPartition = partitions.some(
      (partition) => partition.schema === table.schema && partition.name === table.name
    );

    return {
      ...table,
      isPartition: isPartition || undefined,
      columns: table.columns.map((column) => ({
        ...column,
        dataType: getRootType(column, domains),
      })),
    };
  });

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
      c.udt_schema,
      c.is_nullable,
      c.is_identity,
      c.column_default,
      pg_catalog.col_description(
        (c.table_schema||'.'||c.table_name)::regclass::oid,
        c.ordinal_position
      ) as column_comment
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
      const isArray = row.data_type === 'ARRAY';
      let dataType = row.udt_name;

      if (isArray && dataType.startsWith('_')) {
        dataType = dataType.slice(1);
      }

      const columnMetadata: ColumnMetadata = {
        name: row.column_name,
        dataType,
        dataTypeSchema: row.udt_schema,
        isNullable: row.is_nullable === 'YES',
        isAutoIncrement: isAutoIncrementColumn(row),
        hasDefaultValue: row.column_default !== null,
      };

      if (isArray) {
        columnMetadata.isArray = true;
      }

      if (row.column_comment) {
        columnMetadata.comment = row.column_comment;
      }

      table.columns.push(columnMetadata);
    }
  }

  return Array.from(tableMap.values());
}

async function introspectViews(db: Kysely<any>, schemas: string[]): Promise<TableMetadata[]> {
  const rawColumns = await sql<RawColumn>`
    SELECT
      c.table_schema,
      c.table_name,
      c.column_name,
      c.data_type,
      c.udt_name,
      c.udt_schema,
      c.is_nullable,
      c.is_identity,
      c.column_default,
      pg_catalog.col_description(
        (c.table_schema||'.'||c.table_name)::regclass::oid,
        c.ordinal_position
      ) as column_comment
    FROM information_schema.columns c
    INNER JOIN information_schema.tables t
      ON c.table_schema = t.table_schema
      AND c.table_name = t.table_name
    WHERE t.table_type = 'VIEW'
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
        isView: true,
      });
    }

    const table = tableMap.get(tableKey);
    if (table) {
      const isArray = row.data_type === 'ARRAY';
      let dataType = row.udt_name;

      if (isArray && dataType.startsWith('_')) {
        dataType = dataType.slice(1);
      }

      const columnMetadata: ColumnMetadata = {
        name: row.column_name,
        dataType,
        dataTypeSchema: row.udt_schema,
        isNullable: row.is_nullable === 'YES',
        isAutoIncrement: false,
        hasDefaultValue: row.column_default !== null,
      };

      if (isArray) {
        columnMetadata.isArray = true;
      }

      if (row.column_comment) {
        columnMetadata.comment = row.column_comment;
      }

      table.columns.push(columnMetadata);
    }
  }

  return Array.from(tableMap.values());
}

async function introspectMaterializedViews(db: Kysely<any>, schemas: string[]): Promise<TableMetadata[]> {
  type RawMatViewColumn = {
    table_schema: string;
    table_name: string;
    column_name: string;
    ordinal_position: number;
    column_default: string | null;
    is_nullable: string;
    data_type: string;
    udt_name: string;
    udt_schema: string;
    typcategory: string;
    element_type: string | null;
    column_comment: string | null;
  };

  const rawColumns = await sql<RawMatViewColumn>`
    SELECT
      n.nspname AS table_schema,
      c.relname AS table_name,
      a.attname AS column_name,
      a.attnum AS ordinal_position,
      pg_get_expr(ad.adbin, ad.adrelid) AS column_default,
      CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable,
      t.typname AS data_type,
      t.typname AS udt_name,
      tn.nspname AS udt_schema,
      t.typcategory,
      et.typname AS element_type,
      col_description(c.oid, a.attnum) AS column_comment
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    JOIN pg_type t ON t.oid = a.atttypid
    JOIN pg_namespace tn ON tn.oid = t.typnamespace
    LEFT JOIN pg_type et ON t.typelem = et.oid AND t.typcategory = 'A'
    LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
    WHERE c.relkind = 'm'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND n.nspname = ANY(${schemas})
    ORDER BY n.nspname, c.relname, a.attnum
  `.execute(db);

  const tableMap = new Map<string, TableMetadata>();

  for (const row of rawColumns.rows) {
    const tableKey = `${row.table_schema}.${row.table_name}`;

    if (!tableMap.has(tableKey)) {
      tableMap.set(tableKey, {
        schema: row.table_schema,
        name: row.table_name,
        columns: [],
        isView: true,
      });
    }

    const table = tableMap.get(tableKey);
    if (table) {
      const isArray = row.typcategory === 'A';
      const dataType = isArray && row.element_type ? row.element_type : row.udt_name;

      const columnMetadata: ColumnMetadata = {
        name: row.column_name,
        dataType,
        dataTypeSchema: row.udt_schema,
        isNullable: row.is_nullable === 'YES',
        isAutoIncrement: row.column_default?.includes('nextval') ?? false,
        hasDefaultValue: row.column_default !== null,
        ...(isArray && { isArray: true }),
        ...(row.column_comment && { comment: row.column_comment }),
      };

      table.columns.push(columnMetadata);
    }
  }

  return Array.from(tableMap.values());
}

async function introspectDomains(db: Kysely<any>): Promise<DomainInfo[]> {
  const result = await sql<DomainInfo>`
    WITH RECURSIVE domain_hierarchy AS (
      SELECT oid, typbasetype
      FROM pg_type
      WHERE typtype = 'd'
        AND 'information_schema'::regnamespace::oid <> typnamespace

      UNION ALL

      SELECT dh.oid, t.typbasetype
      FROM domain_hierarchy AS dh
      JOIN pg_type AS t ON t.oid = dh.typbasetype
    )
    SELECT
      t.typname AS type_name,
      t.typnamespace::regnamespace::text AS type_schema,
      bt.typname AS root_type
    FROM domain_hierarchy AS dh
    JOIN pg_type AS t ON dh.oid = t.oid
    JOIN pg_type AS bt ON dh.typbasetype = bt.oid
    WHERE bt.typbasetype = 0
  `.execute(db);

  return result.rows;
}

async function introspectPartitions(db: Kysely<any>): Promise<PartitionInfo[]> {
  const result = await sql<PartitionInfo>`
    SELECT
      pg_namespace.nspname AS schema,
      pg_class.relname AS name
    FROM pg_inherits
    JOIN pg_class ON pg_inherits.inhrelid = pg_class.oid
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
  `.execute(db);

  return result.rows;
}

function getRootType(column: ColumnMetadata, domains: DomainInfo[]): string {
  const foundDomain = domains.find((domain) => {
    return (
      domain.type_name === column.dataType &&
      domain.type_schema === column.dataTypeSchema
    );
  });
  return foundDomain?.root_type ?? column.dataType;
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
  if (column.is_identity === 'YES') {
    return true;
  }

  if (!column.column_default) {
    return false;
  }

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
