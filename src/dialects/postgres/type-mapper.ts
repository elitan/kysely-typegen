import type { TypeNode } from '@/ast/nodes';
import type { MapTypeOptions } from '@/dialects/types';

function helper(name: string, options: MapTypeOptions): TypeNode {
  options.usedHelpers?.add(name);
  return { kind: 'reference', name };
}

export function mapPostgresType(dataType: string, options: MapTypeOptions): TypeNode {
  const { isNullable, isArray, unknownTypes } = options;

  if (isArray || dataType.endsWith('[]')) {
    const baseTypeName = dataType.endsWith('[]') ? dataType.slice(0, -2) : dataType;
    const elementType = mapPostgresType(baseTypeName, { isNullable: false, isArray: false, unknownTypes, usedHelpers: options.usedHelpers });

    const isSimple = elementType.kind === 'primitive' &&
      ['boolean', 'number', 'string'].includes(elementType.value);

    let arrayType: TypeNode;
    if (isSimple) {
      arrayType = { kind: 'array', elementType };
    } else {
      arrayType = { kind: 'generic', name: 'ArrayType', typeArguments: [elementType] };
    }

    if (isNullable) {
      return {
        kind: 'union',
        types: [arrayType, { kind: 'primitive', value: 'null' }],
      };
    }

    return arrayType;
  }

  let baseType: TypeNode;

  switch (dataType) {
    case 'int2':
    case 'int4':
    case 'smallint':
    case 'integer':
      baseType = { kind: 'primitive', value: 'number' };
      break;

    case 'int8':
    case 'bigint':
      baseType = helper('Int8', options);
      break;

    case 'float4':
    case 'float8':
    case 'real':
    case 'double precision':
      baseType = { kind: 'primitive', value: 'number' };
      break;

    case 'numeric':
    case 'decimal':
      baseType = helper('Numeric', options);
      break;

    case 'varchar':
    case 'char':
    case 'text':
    case 'citext':
    case 'uuid':
      baseType = { kind: 'primitive', value: 'string' };
      break;

    case 'bool':
    case 'boolean':
      baseType = { kind: 'primitive', value: 'boolean' };
      break;

    case 'timestamp':
    case 'timestamptz':
    case 'date':
      baseType = helper('Timestamp', options);
      break;

    case 'time':
    case 'timetz':
      baseType = { kind: 'primitive', value: 'string' };
      break;

    case 'interval':
      baseType = helper('Interval', options);
      break;

    case 'money':
      baseType = { kind: 'primitive', value: 'string' };
      break;

    case 'json':
    case 'jsonb':
      baseType = { kind: 'reference', name: 'JsonValue' };
      break;

    case 'bytea':
      baseType = { kind: 'primitive', value: 'Buffer' };
      break;

    case 'point':
      baseType = helper('Point', options);
      break;

    case 'circle':
      baseType = helper('Circle', options);
      break;

    case 'int4range':
    case 'int8range':
    case 'numrange':
    case 'daterange':
    case 'tsrange':
    case 'tstzrange':
      baseType = { kind: 'primitive', value: 'string' };
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
