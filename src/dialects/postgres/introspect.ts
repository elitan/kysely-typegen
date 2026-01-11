import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { CheckConstraintValues, ColumnMetadata, DatabaseMetadata, EnumMetadata, TableMetadata } from '@/introspect/types';
import type { IntrospectOptions } from '@/dialects/types';
import { parseCheckConstraint } from '@/utils/check-constraint-parser';

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
  domain_name: string | null;
  domain_schema: string | null;
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

type RawCheckConstraint = {
  table_schema: string;
  table_name: string;
  column_name: string;
  check_definition: string;
};

type RawDomainCheckConstraint = {
  domain_schema: string;
  domain_name: string;
  check_definition: string;
};

type CheckConstraintMap = Map<string, CheckConstraintValues>;
type DomainCheckConstraintMap = Map<string, CheckConstraintValues>;

export async function introspectPostgres(
  db: Kysely<any>,
  options: IntrospectOptions,
): Promise<DatabaseMetadata> {
  const [domains, partitions, baseTables, regularViews, materializedViews, enums, checkConstraints, domainCheckConstraints] = await Promise.all([
    introspectDomains(db),
    introspectPartitions(db),
    introspectTables(db, options.schemas),
    introspectViews(db, options.schemas),
    introspectMaterializedViews(db, options.schemas),
    introspectEnums(db, options.schemas),
    introspectCheckConstraints(db, options.schemas),
    introspectDomainCheckConstraints(db, options.schemas),
  ]);

  const tables = [...baseTables, ...regularViews, ...materializedViews].map((table) => {
    const isPartition = partitions.some(
      (partition) => partition.schema === table.schema && partition.name === table.name
    );

    return {
      ...table,
      isPartition: isPartition || undefined,
      columns: table.columns.map((column) => {
        const rootType = getRootType(column, domains);
        const checkConstraint = getCheckConstraint(
          table.schema,
          table.name,
          column,
          checkConstraints,
          domainCheckConstraints,
          domains
        );
        return {
          ...column,
          dataType: rootType,
          ...(checkConstraint && { checkConstraint }),
        };
      }),
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
      c.domain_name,
      c.domain_schema,
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

      if (row.domain_name) {
        columnMetadata.domainName = row.domain_name;
        columnMetadata.domainSchema = row.domain_schema ?? undefined;
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
      c.domain_name,
      c.domain_schema,
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

      if (row.domain_name) {
        columnMetadata.domainName = row.domain_name;
        columnMetadata.domainSchema = row.domain_schema ?? undefined;
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
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    return value.slice(1, -1).split(',');
  }

  return [value];
}

async function introspectCheckConstraints(db: Kysely<any>, schemas: string[]): Promise<CheckConstraintMap> {
  const rawConstraints = await sql<RawCheckConstraint>`
    SELECT
      n.nspname AS table_schema,
      c.relname AS table_name,
      a.attname AS column_name,
      pg_get_constraintdef(pgc.oid) AS check_definition
    FROM pg_constraint pgc
    JOIN pg_class c ON pgc.conrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_attribute a ON a.attrelid = pgc.conrelid AND a.attnum = ANY(pgc.conkey)
    WHERE pgc.contype = 'c'
      AND array_length(pgc.conkey, 1) = 1
      AND n.nspname = ANY(${schemas})
  `.execute(db);

  const constraintMap: CheckConstraintMap = new Map();

  for (const row of rawConstraints.rows) {
    const key = `${row.table_schema}.${row.table_name}.${row.column_name}`;
    if (constraintMap.has(key)) continue;

    const parsed = parseCheckConstraint(row.check_definition);
    if (parsed) {
      constraintMap.set(key, parsed);
    }
  }

  return constraintMap;
}

async function introspectDomainCheckConstraints(db: Kysely<any>, schemas: string[]): Promise<DomainCheckConstraintMap> {
  const rawConstraints = await sql<RawDomainCheckConstraint>`
    SELECT
      n.nspname AS domain_schema,
      t.typname AS domain_name,
      pg_get_constraintdef(pgc.oid) AS check_definition
    FROM pg_constraint pgc
    JOIN pg_type t ON pgc.contypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE pgc.contype = 'c'
      AND n.nspname = ANY(${schemas})
  `.execute(db);

  const constraintMap: DomainCheckConstraintMap = new Map();

  for (const row of rawConstraints.rows) {
    const key = `${row.domain_schema}.${row.domain_name}`;
    if (constraintMap.has(key)) continue;

    const parsed = parseCheckConstraint(row.check_definition);
    if (parsed) {
      constraintMap.set(key, parsed);
    }
  }

  return constraintMap;
}

function getCheckConstraint(
  tableSchema: string,
  tableName: string,
  column: ColumnMetadata,
  checkConstraints: CheckConstraintMap,
  domainCheckConstraints: DomainCheckConstraintMap,
  domains: DomainInfo[]
): CheckConstraintValues | undefined {
  const columnKey = `${tableSchema}.${tableName}.${column.name}`;
  const directConstraint = checkConstraints.get(columnKey);
  if (directConstraint) {
    return directConstraint;
  }

  if (column.domainName && column.domainSchema) {
    const domainKey = `${column.domainSchema}.${column.domainName}`;
    const domainConstraint = domainCheckConstraints.get(domainKey);
    if (domainConstraint) {
      return domainConstraint;
    }
  }

  return undefined;
}
