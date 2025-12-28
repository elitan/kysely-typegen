import type { TypeNode } from '@/ast/nodes';
import type { MapTypeOptions } from '@/dialects/types';

function createColumnType(
  selectType: TypeNode,
  insertType?: TypeNode,
  updateType?: TypeNode
): TypeNode {
  const typeArguments: TypeNode[] = [selectType];

  if (insertType) {
    typeArguments.push(insertType);

    if (updateType) {
      typeArguments.push(updateType);
    }
  }

  return {
    kind: 'generic',
    name: 'ColumnType',
    typeArguments,
  };
}

export function mapPostgresType(dataType: string, options: MapTypeOptions): TypeNode {
  const { isNullable, isArray, unknownTypes } = options;

  if (isArray || dataType.endsWith('[]')) {
    const baseTypeName = dataType.endsWith('[]') ? dataType.slice(0, -2) : dataType;
    const elementType = mapPostgresType(baseTypeName, { isNullable: false, isArray: false, unknownTypes });

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
      baseType = createColumnType(
        { kind: 'primitive', value: 'string' },
        {
          kind: 'union',
          types: [
            { kind: 'primitive', value: 'string' },
            { kind: 'primitive', value: 'number' },
            { kind: 'primitive', value: 'bigint' },
          ],
        },
        {
          kind: 'union',
          types: [
            { kind: 'primitive', value: 'string' },
            { kind: 'primitive', value: 'number' },
            { kind: 'primitive', value: 'bigint' },
          ],
        }
      );
      break;

    case 'float4':
    case 'float8':
    case 'real':
    case 'double precision':
      baseType = { kind: 'primitive', value: 'number' };
      break;

    case 'numeric':
    case 'decimal':
      baseType = createColumnType(
        { kind: 'primitive', value: 'string' },
        {
          kind: 'union',
          types: [
            { kind: 'primitive', value: 'number' },
            { kind: 'primitive', value: 'string' },
          ],
        },
        {
          kind: 'union',
          types: [
            { kind: 'primitive', value: 'number' },
            { kind: 'primitive', value: 'string' },
          ],
        }
      );
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
      baseType = createColumnType(
        { kind: 'primitive', value: 'Date' },
        {
          kind: 'union',
          types: [
            { kind: 'primitive', value: 'Date' },
            { kind: 'primitive', value: 'string' },
          ],
        },
        {
          kind: 'union',
          types: [
            { kind: 'primitive', value: 'Date' },
            { kind: 'primitive', value: 'string' },
          ],
        }
      );
      break;

    case 'time':
    case 'timetz':
      baseType = { kind: 'primitive', value: 'string' };
      break;

    case 'interval':
      baseType = createColumnType(
        { kind: 'reference', name: 'IPostgresInterval' },
        {
          kind: 'union',
          types: [
            { kind: 'reference', name: 'IPostgresInterval' },
            { kind: 'primitive', value: 'string' },
          ],
        },
        {
          kind: 'union',
          types: [
            { kind: 'reference', name: 'IPostgresInterval' },
            { kind: 'primitive', value: 'string' },
          ],
        }
      );
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
