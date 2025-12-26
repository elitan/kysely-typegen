import { describe, expect, test } from 'bun:test';
import type { DatabaseMetadata } from '@/introspect/types';
import { transformDatabase, mapPostgresType } from '@/transform';

describe('Transform', () => {
  describe('mapPostgresType', () => {
    test('should map common PostgreSQL types to TypeScript', () => {
      expect(mapPostgresType('int4', false)).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapPostgresType('float4', false)).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapPostgresType('float8', false)).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapPostgresType('varchar', false)).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapPostgresType('text', false)).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapPostgresType('bool', false)).toEqual({ kind: 'primitive', value: 'boolean' });
    });

    test('should map bigint to ColumnType with string/number/bigint', () => {
      const result = mapPostgresType('int8', false);
      expect(result.kind).toBe('generic');
      if (result.kind === 'generic') {
        expect(result.name).toBe('ColumnType');
        expect(result.typeArguments).toHaveLength(3);
        expect(result.typeArguments[0]).toEqual({ kind: 'primitive', value: 'string' });
      }
    });

    test('should map timestamp to ColumnType with Date and string', () => {
      const timestampResult = mapPostgresType('timestamp', false);
      expect(timestampResult.kind).toBe('generic');
      if (timestampResult.kind === 'generic') {
        expect(timestampResult.name).toBe('ColumnType');
        expect(timestampResult.typeArguments).toHaveLength(3);
        expect(timestampResult.typeArguments[0]).toEqual({ kind: 'primitive', value: 'Date' });
      }

      const timestamptzResult = mapPostgresType('timestamptz', false);
      expect(timestamptzResult.kind).toBe('generic');
      if (timestamptzResult.kind === 'generic') {
        expect(timestamptzResult.name).toBe('ColumnType');
      }
    });

    test('should map jsonb to unknown', () => {
      expect(mapPostgresType('jsonb', false)).toEqual({ kind: 'primitive', value: 'unknown' });
      expect(mapPostgresType('json', false)).toEqual({ kind: 'primitive', value: 'unknown' });
    });

    test('should wrap nullable types in union with null', () => {
      const result = mapPostgresType('varchar', true);
      expect(result.kind).toBe('union');
      if (result.kind === 'union') {
        expect(result.types).toHaveLength(2);
        expect(result.types[0]).toEqual({ kind: 'primitive', value: 'string' });
        expect(result.types[1]).toEqual({ kind: 'primitive', value: 'null' });
      }
    });

    test('should handle unknown types', () => {
      expect(mapPostgresType('custom_type', false)).toEqual({ kind: 'primitive', value: 'unknown' });
    });
  });

  describe('transformDatabase', () => {
    test('should transform simple table to interface', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'users',
            columns: [
              {
                name: 'id',
                dataType: 'int4',
                isNullable: false,
                isAutoIncrement: true,
                hasDefaultValue: true,
              },
              {
                name: 'email',
                dataType: 'varchar',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
            ],
          },
        ],
        enums: [],
      };

      const { program } = transformDatabase(metadata);

      // Should have import, Generated type, and 2 interfaces (User + DB)
      expect(program.declarations).toHaveLength(4);

      // Check import
      const importDecl = program.declarations[0];
      expect(importDecl?.kind).toBe('import');

      // Check Generated type
      const generatedType = program.declarations[1];
      expect(generatedType?.kind).toBe('typeAlias');
      if (generatedType?.kind === 'typeAlias') {
        expect(generatedType.name).toBe('Generated<T>');
      }

      // Check User interface
      const userInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'User'
      );
      expect(userInterface).toBeDefined();
      if (userInterface?.kind === 'interface') {
        expect(userInterface.exported).toBe(true);
        expect(userInterface.properties).toHaveLength(2);

        const idProp = userInterface.properties.find((p) => p.name === 'id');
        expect(idProp?.type.kind).toBe('generic');
        if (idProp?.type.kind === 'generic') {
          expect(idProp.type.name).toBe('Generated');
        }

        const emailProp = userInterface.properties.find((p) => p.name === 'email');
        expect(emailProp?.type).toEqual({ kind: 'primitive', value: 'string' });
      }

      // Check DB interface
      const dbInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'DB'
      );
      expect(dbInterface).toBeDefined();
      if (dbInterface?.kind === 'interface') {
        expect(dbInterface.properties).toHaveLength(1);
        expect(dbInterface.properties[0]?.name).toBe('users');
        expect(dbInterface.properties[0]?.type).toEqual({ kind: 'reference', name: 'User' });
      }
    });

    test('should transform enum types', () => {
      const metadata: DatabaseMetadata = {
        tables: [],
        enums: [
          {
            schema: 'public',
            name: 'status_enum',
            values: ['pending', 'approved', 'rejected'],
          },
        ],
      };

      const { program } = transformDatabase(metadata);

      const statusType = program.declarations.find(
        (d) => d.kind === 'typeAlias' && d.name === 'StatusEnum'
      );
      expect(statusType).toBeDefined();
      if (statusType?.kind === 'typeAlias') {
        expect(statusType.type.kind).toBe('union');
        if (statusType.type.kind === 'union') {
          expect(statusType.type.types).toHaveLength(3);
          expect(statusType.type.types[0]).toEqual({ kind: 'literal', value: 'pending' });
          expect(statusType.type.types[1]).toEqual({ kind: 'literal', value: 'approved' });
          expect(statusType.type.types[2]).toEqual({ kind: 'literal', value: 'rejected' });
        }
      }
    });

    test('should handle nullable columns', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'posts',
            columns: [
              {
                name: 'content',
                dataType: 'text',
                isNullable: true,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
            ],
          },
        ],
        enums: [],
      };

      const { program } = transformDatabase(metadata);

      const postInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'Post'
      );
      if (postInterface?.kind === 'interface') {
        const contentProp = postInterface.properties.find((p) => p.name === 'content');
        expect(contentProp?.type.kind).toBe('union');
        if (contentProp?.type.kind === 'union') {
          expect(contentProp.type.types).toHaveLength(2);
        }
      }
    });

    test('should map enum columns to enum types', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'comments',
            columns: [
              {
                name: 'id',
                dataType: 'int4',
                isNullable: false,
                isAutoIncrement: true,
                hasDefaultValue: true,
              },
              {
                name: 'status',
                dataType: 'status_enum',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
            ],
          },
        ],
        enums: [
          {
            schema: 'public',
            name: 'status_enum',
            values: ['pending', 'approved', 'rejected'],
          },
        ],
      };

      const { program } = transformDatabase(metadata);

      const commentInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'Comment'
      );

      expect(commentInterface).toBeDefined();
      if (commentInterface?.kind === 'interface') {
        const statusProp = commentInterface.properties.find((p) => p.name === 'status');
        expect(statusProp).toBeDefined();
        expect(statusProp?.type).toEqual({ kind: 'reference', name: 'StatusEnum' });
      }
    });

    test('should handle nullable enum columns', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'comments',
            columns: [
              {
                name: 'status',
                dataType: 'status_enum',
                isNullable: true,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
            ],
          },
        ],
        enums: [
          {
            schema: 'public',
            name: 'status_enum',
            values: ['pending', 'approved'],
          },
        ],
      };

      const { program } = transformDatabase(metadata);

      const commentInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'Comment'
      );

      if (commentInterface?.kind === 'interface') {
        const statusProp = commentInterface.properties.find((p) => p.name === 'status');
        expect(statusProp?.type.kind).toBe('union');
        if (statusProp?.type.kind === 'union') {
          expect(statusProp.type.types).toHaveLength(2);
          expect(statusProp.type.types[0]).toEqual({ kind: 'reference', name: 'StatusEnum' });
          expect(statusProp.type.types[1]).toEqual({ kind: 'primitive', value: 'null' });
        }
      }
    });
  });

  describe('table filtering', () => {
    const testMetadata: DatabaseMetadata = {
      tables: [
        {
          schema: 'public',
          name: 'users',
          columns: [
            { name: 'id', dataType: 'int4', isNullable: false, isAutoIncrement: true, hasDefaultValue: true },
          ],
        },
        {
          schema: 'public',
          name: 'posts',
          columns: [
            { name: 'id', dataType: 'int4', isNullable: false, isAutoIncrement: true, hasDefaultValue: true },
          ],
        },
        {
          schema: 'auth',
          name: 'sessions',
          columns: [
            { name: 'id', dataType: 'int4', isNullable: false, isAutoIncrement: true, hasDefaultValue: true },
          ],
        },
        {
          schema: 'public',
          name: 'internal_logs',
          columns: [
            { name: 'id', dataType: 'int4', isNullable: false, isAutoIncrement: true, hasDefaultValue: true },
          ],
        },
      ],
      enums: [],
    };

    test('should include only matching tables with include pattern', () => {
      const { program } = transformDatabase(testMetadata, {
        includePattern: ['public.user*'],
      });

      const interfaces = program.declarations.filter((d) => d.kind === 'interface' && d.name !== 'DB');
      expect(interfaces).toHaveLength(1);
      expect(interfaces[0]?.name).toBe('User');
    });

    test('should exclude matching tables with exclude pattern', () => {
      const { program } = transformDatabase(testMetadata, {
        excludePattern: ['*internal*'],
      });

      const interfaces = program.declarations.filter((d) => d.kind === 'interface' && d.name !== 'DB');
      expect(interfaces).toHaveLength(3);

      const names = interfaces.map((i) => i.name);
      expect(names).toContain('User');
      expect(names).toContain('Post');
      expect(names).toContain('Session');
      expect(names).not.toContain('InternalLog');
    });

    test('should handle multiple include patterns', () => {
      const { program } = transformDatabase(testMetadata, {
        includePattern: ['public.users', 'auth.*'],
      });

      const interfaces = program.declarations.filter((d) => d.kind === 'interface' && d.name !== 'DB');
      expect(interfaces).toHaveLength(2);

      const names = interfaces.map((i) => i.name);
      expect(names).toContain('User');
      expect(names).toContain('Session');
    });

    test('should combine include and exclude patterns', () => {
      const { program } = transformDatabase(testMetadata, {
        includePattern: ['public.*'],
        excludePattern: ['*internal*'],
      });

      const interfaces = program.declarations.filter((d) => d.kind === 'interface' && d.name !== 'DB');
      expect(interfaces).toHaveLength(2);

      const names = interfaces.map((i) => i.name);
      expect(names).toContain('User');
      expect(names).toContain('Post');
      expect(names).not.toContain('InternalLog');
    });

    test('should update DB interface with filtered tables only', () => {
      const { program } = transformDatabase(testMetadata, {
        includePattern: ['public.users'],
      });

      const dbInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'DB'
      );

      if (dbInterface?.kind === 'interface') {
        expect(dbInterface.properties).toHaveLength(1);
        expect(dbInterface.properties[0]?.name).toBe('users');
      }
    });
  });

  describe('array types', () => {
    test('should map text[] to string[]', () => {
      const result = mapPostgresType('text[]', false);
      expect(result.kind).toBe('array');
      if (result.kind === 'array') {
        expect(result.elementType).toEqual({ kind: 'primitive', value: 'string' });
      }
    });

    test('should map int4[] to number[]', () => {
      const result = mapPostgresType('int4[]', false);
      expect(result.kind).toBe('array');
      if (result.kind === 'array') {
        expect(result.elementType).toEqual({ kind: 'primitive', value: 'number' });
      }
    });

    test('should map nullable array types', () => {
      const result = mapPostgresType('varchar[]', true);
      expect(result.kind).toBe('union');
      if (result.kind === 'union') {
        expect(result.types).toHaveLength(2);
        expect(result.types[0]?.kind).toBe('array');
        if (result.types[0]?.kind === 'array') {
          expect(result.types[0].elementType).toEqual({ kind: 'primitive', value: 'string' });
        }
        expect(result.types[1]).toEqual({ kind: 'primitive', value: 'null' });
      }
    });

    test('should map jsonb[] to unknown[]', () => {
      const result = mapPostgresType('jsonb[]', false);
      expect(result.kind).toBe('array');
      if (result.kind === 'array') {
        expect(result.elementType).toEqual({ kind: 'primitive', value: 'unknown' });
      }
    });

    test('should handle array of bigints with ColumnType', () => {
      const result = mapPostgresType('int8[]', false);
      expect(result.kind).toBe('array');
      if (result.kind === 'array') {
        expect(result.elementType.kind).toBe('generic');
        if (result.elementType.kind === 'generic') {
          expect(result.elementType.name).toBe('ColumnType');
        }
      }
    });

    test('should map uuid[] to string[]', () => {
      const result = mapPostgresType('uuid[]', false);
      expect(result.kind).toBe('array');
      if (result.kind === 'array') {
        expect(result.elementType).toEqual({ kind: 'primitive', value: 'string' });
      }
    });

    test('should handle boolean arrays', () => {
      const result = mapPostgresType('bool[]', false);
      expect(result.kind).toBe('array');
      if (result.kind === 'array') {
        expect(result.elementType).toEqual({ kind: 'primitive', value: 'boolean' });
      }
    });

    test('should transform table with array columns', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'products',
            columns: [
              {
                name: 'id',
                dataType: 'int4',
                isNullable: false,
                isAutoIncrement: true,
                hasDefaultValue: true,
              },
              {
                name: 'tags',
                dataType: 'text[]',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
              {
                name: 'prices',
                dataType: 'numeric[]',
                isNullable: true,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
            ],
          },
        ],
        enums: [],
      };

      const { program } = transformDatabase(metadata);

      const productInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'Product'
      );

      expect(productInterface).toBeDefined();
      if (productInterface?.kind === 'interface') {
        const tagsProp = productInterface.properties.find((p) => p.name === 'tags');
        expect(tagsProp?.type.kind).toBe('array');

        const pricesProp = productInterface.properties.find((p) => p.name === 'prices');
        expect(pricesProp?.type.kind).toBe('union');
        if (pricesProp?.type.kind === 'union') {
          expect(pricesProp.type.types[0]?.kind).toBe('array');
        }
      }
    });
  });

  describe('additional postgres types', () => {
    test('should map UUID to string', () => {
      expect(mapPostgresType('uuid', false)).toEqual({ kind: 'primitive', value: 'string' });
    });

    test('should map bytea to Buffer', () => {
      expect(mapPostgresType('bytea', false)).toEqual({ kind: 'primitive', value: 'Buffer' });
    });

    test('should map time and timetz to string', () => {
      expect(mapPostgresType('time', false)).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapPostgresType('timetz', false)).toEqual({ kind: 'primitive', value: 'string' });
    });

    test('should map citext to string', () => {
      expect(mapPostgresType('citext', false)).toEqual({ kind: 'primitive', value: 'string' });
    });

    test('should map date to ColumnType with Date and string', () => {
      const result = mapPostgresType('date', false);
      expect(result.kind).toBe('generic');
      if (result.kind === 'generic') {
        expect(result.name).toBe('ColumnType');
        expect(result.typeArguments).toHaveLength(3);
        expect(result.typeArguments[0]).toEqual({ kind: 'primitive', value: 'Date' });
      }
    });

    test('should map numeric and decimal to ColumnType', () => {
      const numericResult = mapPostgresType('numeric', false);
      expect(numericResult.kind).toBe('generic');
      if (numericResult.kind === 'generic') {
        expect(numericResult.name).toBe('ColumnType');
        expect(numericResult.typeArguments[0]).toEqual({ kind: 'primitive', value: 'string' });
      }

      const decimalResult = mapPostgresType('decimal', false);
      expect(decimalResult.kind).toBe('generic');
      if (decimalResult.kind === 'generic') {
        expect(decimalResult.name).toBe('ColumnType');
        expect(decimalResult.typeArguments[0]).toEqual({ kind: 'primitive', value: 'string' });
      }
    });

    test('should map float types to number', () => {
      expect(mapPostgresType('float4', false)).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapPostgresType('float8', false)).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapPostgresType('real', false)).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapPostgresType('double precision', false)).toEqual({ kind: 'primitive', value: 'number' });
    });

    test('should map smallint and integer to number', () => {
      expect(mapPostgresType('int2', false)).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapPostgresType('smallint', false)).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapPostgresType('integer', false)).toEqual({ kind: 'primitive', value: 'number' });
    });

    test('should map char and varchar to string', () => {
      expect(mapPostgresType('char', false)).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapPostgresType('varchar', false)).toEqual({ kind: 'primitive', value: 'string' });
    });

    test('should map bool and boolean to boolean', () => {
      expect(mapPostgresType('bool', false)).toEqual({ kind: 'primitive', value: 'boolean' });
      expect(mapPostgresType('boolean', false)).toEqual({ kind: 'primitive', value: 'boolean' });
    });

    test('should map money to string', () => {
      expect(mapPostgresType('money', false)).toEqual({ kind: 'primitive', value: 'string' });
    });

    test('should map interval to string', () => {
      expect(mapPostgresType('interval', false)).toEqual({ kind: 'primitive', value: 'string' });
    });

    test('should map range types to string', () => {
      expect(mapPostgresType('int4range', false)).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapPostgresType('int8range', false)).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapPostgresType('numrange', false)).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapPostgresType('daterange', false)).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapPostgresType('tsrange', false)).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapPostgresType('tstzrange', false)).toEqual({ kind: 'primitive', value: 'string' });
    });

    test('should map geometric types to unknown (not yet supported)', () => {
      expect(mapPostgresType('point', false)).toEqual({ kind: 'primitive', value: 'unknown' });
      expect(mapPostgresType('line', false)).toEqual({ kind: 'primitive', value: 'unknown' });
      expect(mapPostgresType('circle', false)).toEqual({ kind: 'primitive', value: 'unknown' });
      expect(mapPostgresType('polygon', false)).toEqual({ kind: 'primitive', value: 'unknown' });
      expect(mapPostgresType('box', false)).toEqual({ kind: 'primitive', value: 'unknown' });
      expect(mapPostgresType('path', false)).toEqual({ kind: 'primitive', value: 'unknown' });
    });

    test('should map network types to unknown (not yet supported)', () => {
      expect(mapPostgresType('inet', false)).toEqual({ kind: 'primitive', value: 'unknown' });
      expect(mapPostgresType('cidr', false)).toEqual({ kind: 'primitive', value: 'unknown' });
      expect(mapPostgresType('macaddr', false)).toEqual({ kind: 'primitive', value: 'unknown' });
      expect(mapPostgresType('macaddr8', false)).toEqual({ kind: 'primitive', value: 'unknown' });
    });

    test('should map bit string types to unknown (not yet supported)', () => {
      expect(mapPostgresType('bit', false)).toEqual({ kind: 'primitive', value: 'unknown' });
      expect(mapPostgresType('varbit', false)).toEqual({ kind: 'primitive', value: 'unknown' });
    });

    test('should map xml to unknown (not yet supported)', () => {
      expect(mapPostgresType('xml', false)).toEqual({ kind: 'primitive', value: 'unknown' });
    });

    test('should transform table with various postgres types', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'complex_types',
            columns: [
              {
                name: 'uuid_col',
                dataType: 'uuid',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
              {
                name: 'bytea_col',
                dataType: 'bytea',
                isNullable: true,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
              {
                name: 'json_col',
                dataType: 'jsonb',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
              {
                name: 'decimal_col',
                dataType: 'numeric',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
            ],
          },
        ],
        enums: [],
      };

      const { program } = transformDatabase(metadata);

      const complexInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'ComplexType'
      );

      expect(complexInterface).toBeDefined();
      if (complexInterface?.kind === 'interface') {
        const uuidCol = complexInterface.properties.find((p) => p.name === 'uuid_col');
        expect(uuidCol?.type).toEqual({ kind: 'primitive', value: 'string' });

        const byteaCol = complexInterface.properties.find((p) => p.name === 'bytea_col');
        expect(byteaCol?.type.kind).toBe('union');

        const jsonCol = complexInterface.properties.find((p) => p.name === 'json_col');
        expect(jsonCol?.type).toEqual({ kind: 'primitive', value: 'unknown' });

        const decimalCol = complexInterface.properties.find((p) => p.name === 'decimal_col');
        expect(decimalCol?.type.kind).toBe('generic');
      }
    });
  });

  describe('edge cases', () => {
    test('should handle table with single column', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'simple',
            columns: [
              {
                name: 'id',
                dataType: 'int4',
                isNullable: false,
                isAutoIncrement: true,
                hasDefaultValue: true,
              },
            ],
          },
        ],
        enums: [],
      };

      const { program } = transformDatabase(metadata);

      const simpleInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'Simple'
      );

      expect(simpleInterface).toBeDefined();
      if (simpleInterface?.kind === 'interface') {
        expect(simpleInterface.properties).toHaveLength(1);
        expect(simpleInterface.properties[0]?.name).toBe('id');
      }
    });

    test('should handle empty database (no tables)', () => {
      const metadata: DatabaseMetadata = {
        tables: [],
        enums: [],
      };

      const { program } = transformDatabase(metadata);

      const dbInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'DB'
      );

      expect(dbInterface).toBeDefined();
      if (dbInterface?.kind === 'interface') {
        expect(dbInterface.properties).toHaveLength(0);
      }
    });

    test('should handle tables with reserved TypeScript keywords in names', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'types',
            columns: [
              {
                name: 'interface',
                dataType: 'varchar',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
              {
                name: 'class',
                dataType: 'varchar',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
              {
                name: 'const',
                dataType: 'varchar',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
            ],
          },
        ],
        enums: [],
      };

      const { program } = transformDatabase(metadata);

      const typeInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'Type'
      );

      expect(typeInterface).toBeDefined();
      if (typeInterface?.kind === 'interface') {
        expect(typeInterface.properties).toHaveLength(3);
        const names = typeInterface.properties.map((p) => p.name);
        expect(names).toContain('interface');
        expect(names).toContain('class');
        expect(names).toContain('const');
      }
    });

    test('should handle column names with special characters', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'special',
            columns: [
              {
                name: 'user-id',
                dataType: 'int4',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
              {
                name: 'email@domain',
                dataType: 'varchar',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
            ],
          },
        ],
        enums: [],
      };

      const { program } = transformDatabase(metadata);

      const specialInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'Special'
      );

      expect(specialInterface).toBeDefined();
      if (specialInterface?.kind === 'interface') {
        expect(specialInterface.properties).toHaveLength(2);
        expect(specialInterface.properties[0]?.name).toBe('user-id');
        expect(specialInterface.properties[1]?.name).toBe('email@domain');
      }
    });

    test('should handle table names with numbers', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'table_123',
            columns: [
              {
                name: 'id',
                dataType: 'int4',
                isNullable: false,
                isAutoIncrement: true,
                hasDefaultValue: true,
              },
            ],
          },
        ],
        enums: [],
      };

      const { program } = transformDatabase(metadata);

      const tableInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'Table123'
      );

      expect(tableInterface).toBeDefined();
    });

    test('should handle tables with all nullable columns', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'nullable_table',
            columns: [
              {
                name: 'col1',
                dataType: 'varchar',
                isNullable: true,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
              {
                name: 'col2',
                dataType: 'int4',
                isNullable: true,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
              {
                name: 'col3',
                dataType: 'bool',
                isNullable: true,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
            ],
          },
        ],
        enums: [],
      };

      const { program } = transformDatabase(metadata);

      const nullableInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'NullableTable'
      );

      expect(nullableInterface).toBeDefined();
      if (nullableInterface?.kind === 'interface') {
        expect(nullableInterface.properties).toHaveLength(3);
        nullableInterface.properties.forEach((prop) => {
          expect(prop.type.kind).toBe('union');
        });
      }
    });

    test('should handle enum with single value', () => {
      const metadata: DatabaseMetadata = {
        tables: [],
        enums: [
          {
            schema: 'public',
            name: 'single_enum',
            values: ['only'],
          },
        ],
      };

      const { program } = transformDatabase(metadata);

      const singleEnum = program.declarations.find(
        (d) => d.kind === 'typeAlias' && d.name === 'SingleEnum'
      );

      expect(singleEnum).toBeDefined();
      if (singleEnum?.kind === 'typeAlias') {
        expect(singleEnum.type.kind).toBe('union');
        if (singleEnum.type.kind === 'union') {
          expect(singleEnum.type.types).toHaveLength(1);
          expect(singleEnum.type.types[0]).toEqual({ kind: 'literal', value: 'only' });
        }
      }
    });

    test('should handle very long table names', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'very_long_table_name_that_goes_on_and_on_and_on',
            columns: [
              {
                name: 'id',
                dataType: 'int4',
                isNullable: false,
                isAutoIncrement: true,
                hasDefaultValue: true,
              },
            ],
          },
        ],
        enums: [],
      };

      const { program } = transformDatabase(metadata);

      const longInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'VeryLongTableNameThatGoesOnAndOnAndOn'
      );

      expect(longInterface).toBeDefined();
    });

    test('should handle table with columns that have defaults but are not auto-increment', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'defaults',
            columns: [
              {
                name: 'id',
                dataType: 'int4',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: true,
              },
              {
                name: 'created_at',
                dataType: 'timestamptz',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: true,
              },
            ],
          },
        ],
        enums: [],
      };

      const { program } = transformDatabase(metadata);

      const defaultInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'Default'
      );

      expect(defaultInterface).toBeDefined();
      if (defaultInterface?.kind === 'interface') {
        const idProp = defaultInterface.properties.find((p) => p.name === 'id');
        expect(idProp?.type.kind).not.toBe('generic');

        const createdProp = defaultInterface.properties.find((p) => p.name === 'created_at');
        expect(createdProp?.type.kind).toBe('generic');
        if (createdProp?.type.kind === 'generic') {
          expect(createdProp.type.name).toBe('ColumnType');
        }
      }
    });
  });

  describe('schema-qualified enums', () => {
    test('should prefix enum type names with schema for non-public schemas', () => {
      const metadata: DatabaseMetadata = {
        tables: [],
        enums: [
          {
            schema: 'public',
            name: 'status_enum',
            values: ['pending', 'approved'],
          },
          {
            schema: 'auth',
            name: 'role_enum',
            values: ['admin', 'user'],
          },
        ],
      };

      const { program } = transformDatabase(metadata);

      const publicEnum = program.declarations.find(
        (d) => d.kind === 'typeAlias' && d.name === 'StatusEnum'
      );
      expect(publicEnum).toBeDefined();

      const authEnum = program.declarations.find(
        (d) => d.kind === 'typeAlias' && d.name === 'AuthRoleEnum'
      );
      expect(authEnum).toBeDefined();
    });

    test('should correctly reference schema-qualified enum in column type', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'auth',
            name: 'users',
            columns: [
              {
                name: 'id',
                dataType: 'int4',
                isNullable: false,
                isAutoIncrement: true,
                hasDefaultValue: true,
              },
              {
                name: 'role',
                dataType: 'role_enum',
                dataTypeSchema: 'auth',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
            ],
          },
        ],
        enums: [
          {
            schema: 'auth',
            name: 'role_enum',
            values: ['admin', 'user'],
          },
        ],
      };

      const { program } = transformDatabase(metadata);

      const userInterface = program.declarations.find(
        (d) => d.kind === 'interface' && d.name === 'User'
      );
      expect(userInterface).toBeDefined();
      if (userInterface?.kind === 'interface') {
        const roleProp = userInterface.properties.find((p) => p.name === 'role');
        expect(roleProp?.type).toEqual({ kind: 'reference', name: 'AuthRoleEnum' });
      }
    });
  });

  describe('unknown type warnings', () => {
    test('should return warnings for unknown postgres types', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'test',
            columns: [
              {
                name: 'id',
                dataType: 'int4',
                isNullable: false,
                isAutoIncrement: true,
                hasDefaultValue: true,
              },
              {
                name: 'geo',
                dataType: 'geometry',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
              {
                name: 'network',
                dataType: 'inet',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
            ],
          },
        ],
        enums: [],
      };

      const result = transformDatabase(metadata);

      expect(result.warnings).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);

      const unknownTypes = result.warnings.map((w) => w.pgType);
      expect(unknownTypes).toContain('geometry');
      expect(unknownTypes).toContain('inet');
    });

    test('should dedupe warnings by type', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'test1',
            columns: [
              {
                name: 'geo1',
                dataType: 'geometry',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
            ],
          },
          {
            schema: 'public',
            name: 'test2',
            columns: [
              {
                name: 'geo2',
                dataType: 'geometry',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
            ],
          },
        ],
        enums: [],
      };

      const result = transformDatabase(metadata);

      const geometryWarnings = result.warnings.filter((w) => w.pgType === 'geometry');
      expect(geometryWarnings).toHaveLength(1);
    });

    test('should return empty warnings for known types', () => {
      const metadata: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'test',
            columns: [
              {
                name: 'id',
                dataType: 'int4',
                isNullable: false,
                isAutoIncrement: true,
                hasDefaultValue: true,
              },
              {
                name: 'name',
                dataType: 'varchar',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
            ],
          },
        ],
        enums: [],
      };

      const result = transformDatabase(metadata);

      expect(result.warnings).toHaveLength(0);
    });
  });
});
