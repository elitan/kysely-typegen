import type { InterfaceNode, PropertyNode, TypeNode } from '@/ast/nodes';
import type { ColumnMetadata, EnumMetadata, TableMetadata } from '@/introspect/types';
import { toCamelCase } from '@/utils/case-converter';
import type { TransformOptions, TypeMapper } from '@/transform/types';
import { toPascalCase, singularize } from '@/transform/utils';
import type { EnumNameResolver } from '@/transform/enum';

export function transformTable(
  table: TableMetadata,
  enums: EnumMetadata[],
  enumResolver: EnumNameResolver,
  mapType: TypeMapper,
  options?: TransformOptions,
  unknownTypes?: Set<string>,
  usedHelpers?: Set<string>
): InterfaceNode {
  const properties: PropertyNode[] = table.columns.map((column) =>
    transformColumn(column, enums, enumResolver, mapType, options, unknownTypes, usedHelpers)
  );

  return {
    kind: 'interface',
    name: toPascalCase(singularize(table.name)),
    properties,
    exported: true,
  };
}

export function transformColumn(
  column: ColumnMetadata,
  enums: EnumMetadata[],
  enumResolver: EnumNameResolver,
  mapType: TypeMapper,
  options?: TransformOptions,
  unknownTypes?: Set<string>,
  usedHelpers?: Set<string>
): PropertyNode {
  const matchingEnum = enums.find(
    (e) => e.name === column.dataType && e.schema === (column.dataTypeSchema ?? 'public')
  );

  let type: TypeNode;
  if (matchingEnum) {
    const enumTypeName = enumResolver.getName(matchingEnum);
    type = { kind: 'reference', name: enumTypeName };

    if (column.isNullable) {
      type = {
        kind: 'union',
        types: [type, { kind: 'primitive', value: 'null' }],
      };
    }
  } else if (column.checkConstraint) {
    if (column.checkConstraint.type === 'boolean') {
      type = { kind: 'primitive', value: 'boolean' };
      if (column.isNullable) {
        type = {
          kind: 'union',
          types: [type, { kind: 'primitive', value: 'null' }],
        };
      }
    } else {
      const literalTypes: TypeNode[] = column.checkConstraint.values.map((v) => ({
        kind: 'literal' as const,
        value: v,
      }));

      if (column.isNullable) {
        literalTypes.push({ kind: 'primitive', value: 'null' });
      }

      type = { kind: 'union', types: literalTypes };
    }
  } else {
    type = mapType(column.dataType, {
      isNullable: column.isNullable,
      isArray: column.isArray,
      unknownTypes,
      usedHelpers,
    });
  }

  if (column.isAutoIncrement || column.hasDefaultValue) {
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
