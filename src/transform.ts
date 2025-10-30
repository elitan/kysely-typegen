import micromatch from 'micromatch';
import type {
  InterfaceNode,
  PropertyNode,
  ProgramNode,
  TypeNode,
  TypeAliasNode,
} from '@/ast/nodes';
import type { ColumnMetadata, DatabaseMetadata, TableMetadata } from '@/introspect/types';
import { toCamelCase } from '@/utils/case-converter';

type TransformOptions = {
  camelCase?: boolean;
  includePattern?: string[];
  excludePattern?: string[];
};

/**
 * Transform database metadata to AST
 */
export function transformDatabase(metadata: DatabaseMetadata, options?: TransformOptions): ProgramNode {
  const declarations: (InterfaceNode | TypeAliasNode)[] = [];

  // Add imports from kysely
  declarations.push({
    kind: 'import',
    imports: ['ColumnType'],
    from: 'kysely',
    typeOnly: true,
  });

  // Add Generated<T> type helper that properly wraps ColumnType
  // This makes columns with defaults optional on insert
  declarations.push({
    kind: 'typeAlias',
    name: 'Generated<T>',
    type: {
      kind: 'raw',
      value: `T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>`,
    },
    exported: true,
  });

  // Transform enums to type aliases
  for (const enumMetadata of metadata.enums) {
    declarations.push(transformEnum(enumMetadata));
  }

  // Filter tables based on include/exclude patterns
  const filteredTables = filterTables(metadata.tables, options);

  // Transform tables to interfaces
  const tableInterfaces: InterfaceNode[] = [];
  for (const table of filteredTables) {
    tableInterfaces.push(transformTable(table, metadata.enums, options));
  }
  declarations.push(...tableInterfaces);

  // Create DB interface
  declarations.push(createDBInterface(filteredTables, options));

  return { declarations };
}

function filterTables(tables: TableMetadata[], options?: TransformOptions): TableMetadata[] {
  if (!options || (!options.includePattern && !options.excludePattern)) {
    return tables;
  }

  return tables.filter((table) => {
    const tablePattern = `${table.schema}.${table.name}`;

    // Check exclude patterns first
    if (options.excludePattern && options.excludePattern.length > 0) {
      if (micromatch.isMatch(tablePattern, options.excludePattern)) {
        return false;
      }
    }

    // Check include patterns
    if (options.includePattern && options.includePattern.length > 0) {
      return micromatch.isMatch(tablePattern, options.includePattern);
    }

    // If no include pattern specified, include by default (unless excluded above)
    return true;
  });
}

function transformEnum(enumMetadata: { name: string; values: string[] }): TypeAliasNode {
  return {
    kind: 'typeAlias',
    name: toPascalCase(enumMetadata.name),
    type: {
      kind: 'union',
      types: enumMetadata.values.map((value) => ({
        kind: 'literal',
        value,
      })),
    },
    exported: true,
  };
}

function transformTable(
  table: TableMetadata,
  enums: { name: string; values: string[] }[],
  options?: TransformOptions
): InterfaceNode {
  const properties: PropertyNode[] = table.columns.map((column) => transformColumn(column, enums, options));

  return {
    kind: 'interface',
    name: toPascalCase(singularize(table.name)),
    properties,
    exported: true,
  };
}

function transformColumn(
  column: ColumnMetadata,
  enums: { name: string; values: string[] }[],
  options?: TransformOptions
): PropertyNode {
  // Check if the column type is an enum
  const matchingEnum = enums.find((e) => e.name === column.dataType);

  let type: TypeNode;
  if (matchingEnum) {
    // Reference the enum type
    const enumTypeName = toPascalCase(matchingEnum.name);
    type = { kind: 'reference', name: enumTypeName };

    // Add null union if nullable
    if (column.isNullable) {
      type = {
        kind: 'union',
        types: [type, { kind: 'primitive', value: 'null' }],
      };
    }
  } else {
    // Use regular type mapping
    type = mapPostgresType(column.dataType, column.isNullable);
  }

  // Wrap auto-increment columns in Generated<>
  if (column.isAutoIncrement) {
    type = {
      kind: 'generic',
      name: 'Generated',
      typeArguments: [type],
    };
  }

  // Apply camelCase conversion to column name if enabled
  const columnName = options?.camelCase ? toCamelCase(column.name) : column.name;

  return {
    name: columnName,
    type,
    optional: false,
  };
}

/**
 * Create a ColumnType<SelectType, InsertType, UpdateType> node
 */
function createColumnType(
  selectType: TypeNode,
  insertType?: TypeNode,
  updateType?: TypeNode
): TypeNode {
  const typeArguments: TypeNode[] = [selectType];

  if (insertType) {
    typeArguments.push(insertType);

    if (updateType) {
      typeArguments.push(updateType);
    }
  }

  return {
    kind: 'generic',
    name: 'ColumnType',
    typeArguments,
  };
}

/**
 * Map PostgreSQL types to TypeScript types
 * Returns ColumnType<S, I, U> for types that need different select/insert/update types
 */
export function mapPostgresType(pgType: string, isNullable: boolean): TypeNode {
  let baseType: TypeNode;

  switch (pgType) {
    // Small integers - simple number
    case 'int2':
    case 'int4':
    case 'smallint':
    case 'integer':
      baseType = { kind: 'primitive', value: 'number' };
      break;

    // Bigint - returns string but can accept number/bigint for insert/update
    case 'int8':
    case 'bigint':
      baseType = createColumnType(
        { kind: 'primitive', value: 'string' },
        {
          kind: 'union',
          types: [
            { kind: 'primitive', value: 'string' },
            { kind: 'primitive', value: 'number' },
            { kind: 'primitive', value: 'bigint' },
          ],
        },
        {
          kind: 'union',
          types: [
            { kind: 'primitive', value: 'string' },
            { kind: 'primitive', value: 'number' },
            { kind: 'primitive', value: 'bigint' },
          ],
        }
      );
      break;

    // Floats
    case 'float4':
    case 'float8':
    case 'real':
    case 'double precision':
      baseType = { kind: 'primitive', value: 'number' };
      break;

    // Numeric/Decimal - returns string but can accept number for insert/update
    case 'numeric':
    case 'decimal':
      baseType = createColumnType(
        { kind: 'primitive', value: 'string' },
        {
          kind: 'union',
          types: [
            { kind: 'primitive', value: 'number' },
            { kind: 'primitive', value: 'string' },
          ],
        },
        {
          kind: 'union',
          types: [
            { kind: 'primitive', value: 'number' },
            { kind: 'primitive', value: 'string' },
          ],
        }
      );
      break;

    // Strings
    case 'varchar':
    case 'char':
    case 'text':
    case 'citext':
    case 'uuid':
      baseType = { kind: 'primitive', value: 'string' };
      break;

    // Boolean
    case 'bool':
    case 'boolean':
      baseType = { kind: 'primitive', value: 'boolean' };
      break;

    // Date/Time - returns Date but can accept Date or string for insert/update
    case 'timestamp':
    case 'timestamptz':
    case 'date':
      baseType = createColumnType(
        { kind: 'primitive', value: 'Date' },
        {
          kind: 'union',
          types: [
            { kind: 'primitive', value: 'Date' },
            { kind: 'primitive', value: 'string' },
          ],
        },
        {
          kind: 'union',
          types: [
            { kind: 'primitive', value: 'Date' },
            { kind: 'primitive', value: 'string' },
          ],
        }
      );
      break;

    case 'time':
    case 'timetz':
      baseType = { kind: 'primitive', value: 'string' };
      break;

    // JSON
    case 'json':
    case 'jsonb':
      baseType = { kind: 'primitive', value: 'unknown' };
      break;

    // Bytea
    case 'bytea':
      baseType = { kind: 'primitive', value: 'Buffer' };
      break;

    default:
      // Unknown types default to unknown
      baseType = { kind: 'primitive', value: 'unknown' };
  }

  // Add null union if nullable
  if (isNullable) {
    return {
      kind: 'union',
      types: [baseType, { kind: 'primitive', value: 'null' }],
    };
  }

  return baseType;
}

function createDBInterface(tables: TableMetadata[], options?: TransformOptions): InterfaceNode {
  const properties: PropertyNode[] = tables.map((table) => {
    // Apply camelCase conversion to table name if enabled
    const tableName = options?.camelCase ? toCamelCase(table.name) : table.name;

    return {
      name: tableName,
      type: {
        kind: 'reference',
        name: toPascalCase(singularize(table.name)),
      },
      optional: false,
    };
  });

  return {
    kind: 'interface',
    name: 'DB',
    properties,
    exported: true,
  };
}

/**
 * Convert snake_case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Simple singularization (just remove trailing 's')
 * TODO: Use a proper library like 'pluralize' for better accuracy
 */
function singularize(str: string): string {
  if (str.endsWith('s')) {
    return str.slice(0, -1);
  }
  return str;
}
