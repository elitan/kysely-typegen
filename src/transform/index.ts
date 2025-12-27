import type { InterfaceNode, TypeAliasNode } from '@/ast/nodes';
import type { DatabaseMetadata } from '@/introspect/types';
import type { TransformOptions, TransformResult, TransformWarning } from '@/transform/types';
import { filterTables } from '@/transform/filter';
import { transformEnum } from '@/transform/enum';
import { transformTable, createDBInterface } from '@/transform/table';

export { mapPostgresType } from '@/transform/type-mapper';
export type { TransformOptions, TransformResult, TransformWarning } from '@/transform/types';

export function transformDatabase(metadata: DatabaseMetadata, options?: TransformOptions): TransformResult {
  const declarations: (InterfaceNode | TypeAliasNode)[] = [];
  const unknownTypes = new Set<string>();

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

  for (const enumMetadata of metadata.enums) {
    declarations.push(transformEnum(enumMetadata));
  }

  const filteredTables = filterTables(metadata.tables, options);

  const tableInterfaces: InterfaceNode[] = [];
  for (const table of filteredTables) {
    tableInterfaces.push(transformTable(table, metadata.enums, options, unknownTypes));
  }
  declarations.push(...tableInterfaces);

  declarations.push(createDBInterface(filteredTables, options));

  const warnings: TransformWarning[] = Array.from(unknownTypes).map((pgType) => ({
    type: 'unknown_type',
    pgType,
  }));

  return { program: { declarations }, warnings };
}
