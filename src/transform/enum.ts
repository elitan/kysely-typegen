import type { TypeAliasNode } from '@/ast/nodes';
import { toPascalCase } from '@/transform/utils';

export function transformEnum(enumMetadata: { name: string; values: string[] }): TypeAliasNode {
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
