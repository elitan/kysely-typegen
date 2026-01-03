import type { TypeAliasNode, TypeNode } from '@/ast/nodes';

function createColumnType(
  selectType: TypeNode,
  insertType: TypeNode,
  updateType: TypeNode
): TypeNode {
  return {
    kind: 'generic',
    name: 'ColumnType',
    typeArguments: [selectType, insertType, updateType],
  };
}

function createUnion(...types: TypeNode[]): TypeNode {
  return { kind: 'union', types };
}

function primitive(value: 'string' | 'number' | 'bigint' | 'Date'): TypeNode {
  if (value === 'Date') {
    return { kind: 'reference', name: 'Date' };
  }
  return { kind: 'primitive', value };
}

function ref(name: string): TypeNode {
  return { kind: 'reference', name };
}

export const HELPER_DEFINITIONS: Record<string, TypeAliasNode> = {
  Timestamp: {
    kind: 'typeAlias',
    name: 'Timestamp',
    exported: true,
    type: createColumnType(
      primitive('Date'),
      createUnion(primitive('Date'), primitive('string')),
      createUnion(primitive('Date'), primitive('string'))
    ),
  },

  Int8: {
    kind: 'typeAlias',
    name: 'Int8',
    exported: true,
    type: createColumnType(
      primitive('string'),
      createUnion(primitive('string'), primitive('number'), primitive('bigint')),
      createUnion(primitive('string'), primitive('number'), primitive('bigint'))
    ),
  },

  Numeric: {
    kind: 'typeAlias',
    name: 'Numeric',
    exported: true,
    type: createColumnType(
      primitive('string'),
      createUnion(primitive('number'), primitive('string')),
      createUnion(primitive('number'), primitive('string'))
    ),
  },

  Interval: {
    kind: 'typeAlias',
    name: 'Interval',
    exported: true,
    type: createColumnType(
      ref('IPostgresInterval'),
      createUnion(ref('IPostgresInterval'), primitive('string')),
      createUnion(ref('IPostgresInterval'), primitive('string'))
    ),
  },

  Point: {
    kind: 'typeAlias',
    name: 'Point',
    exported: true,
    type: { kind: 'raw', value: '{ x: number; y: number }' },
  },

  Circle: {
    kind: 'typeAlias',
    name: 'Circle',
    exported: true,
    type: { kind: 'raw', value: '{ x: number; y: number; radius: number }' },
  },
};

export const HELPER_NAMES = Object.keys(HELPER_DEFINITIONS);

export function isHelperType(name: string): boolean {
  return name in HELPER_DEFINITIONS;
}
