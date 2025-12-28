import type { TypeNode } from '@/ast/nodes';
import type { MapTypeOptions } from '@/dialects/types';

export function mapMssqlType(dataType: string, options: MapTypeOptions): TypeNode {
  const { isNullable, unknownTypes } = options;

  let baseType: TypeNode;
  const lowerType = dataType.toLowerCase();

  switch (lowerType) {
    case 'tinyint':
    case 'smallint':
    case 'int':
    case 'bigint':
      baseType = { kind: 'primitive', value: 'number' };
      break;

    case 'float':
    case 'real':
      baseType = { kind: 'primitive', value: 'number' };
      break;

    case 'decimal':
    case 'numeric':
    case 'money':
    case 'smallmoney':
      baseType = { kind: 'primitive', value: 'number' };
      break;

    case 'char':
    case 'varchar':
    case 'nchar':
    case 'nvarchar':
    case 'text':
    case 'ntext':
      baseType = { kind: 'primitive', value: 'string' };
      break;

    case 'uniqueidentifier':
    case 'xml':
      baseType = { kind: 'primitive', value: 'string' };
      break;

    case 'binary':
    case 'varbinary':
    case 'image':
      baseType = { kind: 'primitive', value: 'Buffer' };
      break;

    case 'bit':
      baseType = { kind: 'primitive', value: 'boolean' };
      break;

    case 'date':
    case 'datetime':
    case 'datetime2':
    case 'smalldatetime':
    case 'time':
    case 'datetimeoffset':
      baseType = { kind: 'primitive', value: 'Date' };
      break;

    case 'sql_variant':
    case 'tvp':
      baseType = { kind: 'primitive', value: 'unknown' };
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
