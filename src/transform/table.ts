import type { InterfaceNode, PropertyNode, TypeNode } from '@/ast/nodes';
import type { ColumnMetadata, TableMetadata } from '@/introspect/types';
import { toCamelCase } from '@/utils/case-converter';
import type { TransformOptions } from '@/transform/types';
import { mapPostgresType } from '@/transform/type-mapper';
import { toPascalCase, singularize } from '@/transform/utils';

export function transformTable(
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

export function transformColumn(
  column: ColumnMetadata,
  enums: { name: string; values: string[] }[],
  options?: TransformOptions
): PropertyNode {
  const matchingEnum = enums.find((e) => e.name === column.dataType);

  let type: TypeNode;
  if (matchingEnum) {
    const enumTypeName = toPascalCase(matchingEnum.name);
    type = { kind: 'reference', name: enumTypeName };

    if (column.isNullable) {
      type = {
        kind: 'union',
        types: [type, { kind: 'primitive', value: 'null' }],
      };
    }
  } else {
    type = mapPostgresType(column.dataType, column.isNullable, column.isArray);
  }

  if (column.isAutoIncrement) {
    type = {
      kind: 'generic',
      name: 'Generated',
      typeArguments: [type],
    };
  }

  const columnName = options?.camelCase ? toCamelCase(column.name) : column.name;

  return {
    name: columnName,
    type,
    optional: false,
  };
}

export function createDBInterface(tables: TableMetadata[], options?: TransformOptions): InterfaceNode {
  const properties: PropertyNode[] = tables.map((table) => {
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
