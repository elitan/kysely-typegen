import type { ZodSchemaNode } from './nodes';

export type ZodMapOptions = {
  isNullable: boolean;
  isArray?: boolean;
  isOptional?: boolean;
  mode: 'select' | 'insert' | 'update';
};

export function mapPostgresTypeToZod(dataType: string, options: ZodMapOptions): ZodSchemaNode {
  const { isNullable, isArray, isOptional, mode } = options;

  if (isArray || dataType.endsWith('[]')) {
    const baseTypeName = dataType.endsWith('[]') ? dataType.slice(0, -2) : dataType;
    const elementSchema = mapPostgresTypeToZod(baseTypeName, {
      isNullable: false,
      isArray: false,
      isOptional: false,
      mode,
    });
    return applyModifiers({ kind: 'zod-array', element: elementSchema }, isNullable, isOptional);
  }

  const baseSchema = mapScalarType(dataType, mode);
  return applyModifiers(baseSchema, isNullable, isOptional);
}

function applyModifiers(
  schema: ZodSchemaNode,
  isNullable: boolean,
  isOptional: boolean | undefined
): ZodSchemaNode {
  const modifiers: ('nullable' | 'optional')[] = [];
  if (isNullable) modifiers.push('nullable');
  if (isOptional) modifiers.push('optional');

  if (modifiers.length > 0) {
    return { kind: 'zod-modified', schema, modifiers };
  }
  return schema;
}

function mapScalarType(dataType: string, mode: 'select' | 'insert' | 'update'): ZodSchemaNode {
  switch (dataType) {
    case 'int2':
    case 'int4':
    case 'smallint':
    case 'integer':
    case 'float4':
    case 'float8':
    case 'real':
    case 'double precision':
      return { kind: 'zod-primitive', method: 'number' };

    case 'int8':
    case 'bigint':
      if (mode === 'select') {
        return { kind: 'zod-primitive', method: 'string' };
      }
      return {
        kind: 'zod-union',
        schemas: [
          { kind: 'zod-primitive', method: 'string' },
          { kind: 'zod-primitive', method: 'number' },
          { kind: 'zod-primitive', method: 'bigint' },
        ],
      };

    case 'numeric':
    case 'decimal':
      if (mode === 'select') {
        return { kind: 'zod-primitive', method: 'string' };
      }
      return {
        kind: 'zod-union',
        schemas: [
          { kind: 'zod-primitive', method: 'string' },
          { kind: 'zod-primitive', method: 'number' },
        ],
      };

    case 'varchar':
    case 'char':
    case 'text':
    case 'citext':
    case 'uuid':
    case 'money':
    case 'time':
    case 'timetz':
      return { kind: 'zod-primitive', method: 'string' };

    case 'bool':
    case 'boolean':
      return { kind: 'zod-primitive', method: 'boolean' };

    case 'timestamp':
    case 'timestamptz':
    case 'date':
      if (mode === 'select') {
        return { kind: 'zod-primitive', method: 'date' };
      }
      return {
        kind: 'zod-union',
        schemas: [
          { kind: 'zod-primitive', method: 'date' },
          { kind: 'zod-primitive', method: 'string' },
        ],
      };

    case 'interval':
      return { kind: 'zod-primitive', method: 'unknown' };

    case 'json':
    case 'jsonb':
      return { kind: 'zod-primitive', method: 'unknown' };

    case 'bytea':
      return { kind: 'zod-custom', typeReference: 'Buffer' };

    case 'point':
      return {
        kind: 'zod-object',
        properties: [
          { name: 'x', schema: { kind: 'zod-primitive', method: 'number' } },
          { name: 'y', schema: { kind: 'zod-primitive', method: 'number' } },
        ],
      };

    case 'circle':
      return {
        kind: 'zod-object',
        properties: [
          { name: 'x', schema: { kind: 'zod-primitive', method: 'number' } },
          { name: 'y', schema: { kind: 'zod-primitive', method: 'number' } },
          { name: 'radius', schema: { kind: 'zod-primitive', method: 'number' } },
        ],
      };

    case 'int4range':
    case 'int8range':
    case 'numrange':
    case 'daterange':
    case 'tsrange':
    case 'tstzrange':
      return { kind: 'zod-primitive', method: 'string' };

    default:
      return { kind: 'zod-primitive', method: 'unknown' };
  }
}
