import type { InterfaceNode, ProgramNode, TypeAliasNode } from '@/ast/nodes';
import type { DatabaseMetadata } from '@/introspect/types';
import type { TransformOptions } from '@/transform/types';
import { filterTables } from '@/transform/filter';
import { transformEnum } from '@/transform/enum';
import { transformTable, createDBInterface } from '@/transform/table';

export { mapPostgresType } from '@/transform/type-mapper';
export type { TransformOptions } from '@/transform/types';

export function transformDatabase(metadata: DatabaseMetadata, options?: TransformOptions): ProgramNode {
  const declarations: (InterfaceNode | TypeAliasNode)[] = [];

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

  for (const enumMetadata of metadata.enums) {
    declarations.push(transformEnum(enumMetadata));
  }

  const filteredTables = filterTables(metadata.tables, options);

  const tableInterfaces: InterfaceNode[] = [];
  for (const table of filteredTables) {
    tableInterfaces.push(transformTable(table, metadata.enums, options));
  }
  declarations.push(...tableInterfaces);

  declarations.push(createDBInterface(filteredTables, options));

  return { declarations };
}
