import type { TypeNode } from '@/ast/nodes';
import type { MapTypeOptions } from '@/dialects/types';

export function mapSqliteType(dataType: string, options: MapTypeOptions): TypeNode {
  const { isNullable, unknownTypes } = options;

  let baseType: TypeNode;
  const lowerType = dataType.toLowerCase();

  switch (lowerType) {
    case 'integer':
    case 'int':
    case 'tinyint':
    case 'smallint':
    case 'mediumint':
    case 'bigint':
      baseType = { kind: 'primitive', value: 'number' };
      break;

    case 'real':
    case 'double':
    case 'float':
      baseType = { kind: 'primitive', value: 'number' };
      break;

    case 'numeric':
    case 'decimal':
      baseType = { kind: 'primitive', value: 'number' };
      break;

    case 'text':
    case 'varchar':
    case 'char':
    case 'clob':
      baseType = { kind: 'primitive', value: 'string' };
      break;

    case 'blob':
      baseType = { kind: 'primitive', value: 'Buffer' };
      break;

    case 'date':
    case 'datetime':
    case 'timestamp':
      baseType = { kind: 'primitive', value: 'string' };
      break;

    case 'boolean':
      baseType = { kind: 'primitive', value: 'number' };
      break;

    case 'json':
      baseType = { kind: 'reference', name: 'JsonValue' };
      break;

    default:
      if (unknownTypes) {
        unknownTypes.add(dataType);
      }
      baseType = { kind: 'primitive', value: 'unknown' };
  }

  if (isNullable) {
    return {
      kind: 'union',
      types: [baseType, { kind: 'primitive', value: 'null' }],
    };
  }

  return baseType;
}
