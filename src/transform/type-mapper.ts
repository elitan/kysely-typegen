import type { TypeNode } from '@/ast/nodes';

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

export function mapPostgresType(
  pgType: string,
  isNullable: boolean,
  isArray?: boolean,
  unknownTypes?: Set<string>
): TypeNode {
  if (isArray || pgType.endsWith('[]')) {
    const baseTypeName = pgType.endsWith('[]') ? pgType.slice(0, -2) : pgType;
    const elementType = mapPostgresType(baseTypeName, false, false, unknownTypes);
    const arrayType: TypeNode = {
      kind: 'array',
      elementType,
    };

    if (isNullable) {
      return {
        kind: 'union',
        types: [arrayType, { kind: 'primitive', value: 'null' }],
      };
    }

    return arrayType;
  }

  let baseType: TypeNode;

  switch (pgType) {
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
    case 'interval':
      baseType = { kind: 'primitive', value: 'string' };
      break;

    case 'money':
      baseType = { kind: 'primitive', value: 'string' };
      break;

    case 'json':
    case 'jsonb':
      baseType = { kind: 'primitive', value: 'unknown' };
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
        unknownTypes.add(pgType);
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
