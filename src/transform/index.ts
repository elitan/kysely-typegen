import type { InterfaceNode, TypeAliasNode, TypeNode } from '@/ast/nodes';
import type { DatabaseMetadata } from '@/introspect/types';
import type { TransformOptions, TransformResult, TransformWarning, TypeMapper } from '@/transform/types';
import { filterTables } from '@/transform/filter';
import { transformEnum, EnumNameResolver } from '@/transform/enum';
import { transformTable, createDBInterface } from '@/transform/table';
import { getDialect } from '@/dialects';
import { mapPostgresType as _mapPostgresType } from '@/dialects/postgres/type-mapper';

export type { TransformOptions, TransformResult, TransformWarning, TypeMapper } from '@/transform/types';

export function mapPostgresType(
  pgType: string,
  isNullable: boolean,
  isArray?: boolean,
  unknownTypes?: Set<string>
): TypeNode {
  return _mapPostgresType(pgType, { isNullable, isArray, unknownTypes });
}

export function transformDatabase(metadata: DatabaseMetadata, options?: TransformOptions): TransformResult {
  const declarations: (InterfaceNode | TypeAliasNode)[] = [];
  const unknownTypes = new Set<string>();

  const dialectName = options?.dialectName ?? 'postgres';
  const dialect = getDialect(dialectName);
  const mapType: TypeMapper = options?.mapType ?? ((dataType, opts) => dialect.mapType(dataType, opts));

  declarations.push({
    kind: 'import',
    imports: ['ColumnType'],
    from: 'kysely',
    typeOnly: true,
  });

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

  declarations.push({
    kind: 'typeAlias',
    name: 'ArrayType<T>',
    type: {
      kind: 'raw',
      value: `ArrayTypeImpl<T> extends (infer U)[]
  ? U[]
  : ArrayTypeImpl<T>`,
    },
    exported: true,
  });

  declarations.push({
    kind: 'typeAlias',
    name: 'ArrayTypeImpl<T>',
    type: {
      kind: 'raw',
      value: `T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S[], I[], U[]>
  : T[]`,
    },
    exported: true,
  });

  declarations.push({
    kind: 'typeAlias',
    name: 'JsonPrimitive',
    type: {
      kind: 'union',
      types: [
        { kind: 'primitive', value: 'string' },
        { kind: 'primitive', value: 'number' },
        { kind: 'primitive', value: 'boolean' },
        { kind: 'primitive', value: 'null' },
      ],
    },
    exported: true,
  });

  declarations.push({
    kind: 'typeAlias',
    name: 'JsonArray',
    type: {
      kind: 'array',
      elementType: { kind: 'reference', name: 'JsonValue' },
    },
    exported: true,
  });

  declarations.push({
    kind: 'typeAlias',
    name: 'JsonObject',
    type: {
      kind: 'raw',
      value: '{ [key: string]: JsonValue }',
    },
    exported: true,
  });

  declarations.push({
    kind: 'typeAlias',
    name: 'JsonValue',
    type: {
      kind: 'union',
      types: [
        { kind: 'reference', name: 'JsonPrimitive' },
        { kind: 'reference', name: 'JsonObject' },
        { kind: 'reference', name: 'JsonArray' },
      ],
    },
    exported: true,
  });

  if (dialectName === 'postgres') {
    declarations.push({
      kind: 'interface',
      name: 'IPostgresInterval',
      properties: [
        { name: 'years', type: { kind: 'primitive', value: 'number' }, optional: true },
        { name: 'months', type: { kind: 'primitive', value: 'number' }, optional: true },
        { name: 'days', type: { kind: 'primitive', value: 'number' }, optional: true },
        { name: 'hours', type: { kind: 'primitive', value: 'number' }, optional: true },
        { name: 'minutes', type: { kind: 'primitive', value: 'number' }, optional: true },
        { name: 'seconds', type: { kind: 'primitive', value: 'number' }, optional: true },
        { name: 'milliseconds', type: { kind: 'primitive', value: 'number' }, optional: true },
      ],
      exported: true,
    });
  }

  if (dialectName === 'mysql') {
    declarations.push({
      kind: 'interface',
      name: 'Point',
      properties: [
        { name: 'x', type: { kind: 'primitive', value: 'number' }, optional: false },
        { name: 'y', type: { kind: 'primitive', value: 'number' }, optional: false },
      ],
      exported: true,
    });

    declarations.push({
      kind: 'typeAlias',
      name: 'LineString',
      type: { kind: 'array', elementType: { kind: 'reference', name: 'Point' } },
      exported: true,
    });

    declarations.push({
      kind: 'typeAlias',
      name: 'Polygon',
      type: { kind: 'array', elementType: { kind: 'reference', name: 'LineString' } },
      exported: true,
    });

    declarations.push({
      kind: 'typeAlias',
      name: 'Geometry',
      type: {
        kind: 'union',
        types: [
          { kind: 'reference', name: 'Point' },
          { kind: 'reference', name: 'LineString' },
          { kind: 'reference', name: 'Polygon' },
        ],
      },
      exported: true,
    });
  }

  const enumResolver = new EnumNameResolver(metadata.enums);

  for (const enumMetadata of metadata.enums) {
    declarations.push(transformEnum(enumMetadata, enumResolver));
  }

  const filteredTables = filterTables(metadata.tables, options);

  const tableInterfaces: InterfaceNode[] = [];
  for (const table of filteredTables) {
    tableInterfaces.push(transformTable(table, metadata.enums, enumResolver, mapType, options, unknownTypes));
  }
  declarations.push(...tableInterfaces);

  declarations.push(createDBInterface(filteredTables, options));

  const warnings: TransformWarning[] = Array.from(unknownTypes).map((pgType) => ({
    type: 'unknown_type',
    pgType,
  }));

  return { program: { declarations }, warnings };
}
