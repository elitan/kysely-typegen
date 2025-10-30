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

      const program = transformDatabase(metadata);

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

      const program = transformDatabase(metadata);

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

      const program = transformDatabase(metadata);

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

      const program = transformDatabase(metadata);

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

      const program = transformDatabase(metadata);

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
      const program = transformDatabase(testMetadata, {
        includePattern: ['public.user*'],
      });

      const interfaces = program.declarations.filter((d) => d.kind === 'interface' && d.name !== 'DB');
      expect(interfaces).toHaveLength(1);
      expect(interfaces[0]?.name).toBe('User');
    });

    test('should exclude matching tables with exclude pattern', () => {
      const program = transformDatabase(testMetadata, {
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
      const program = transformDatabase(testMetadata, {
        includePattern: ['public.users', 'auth.*'],
      });

      const interfaces = program.declarations.filter((d) => d.kind === 'interface' && d.name !== 'DB');
      expect(interfaces).toHaveLength(2);

      const names = interfaces.map((i) => i.name);
      expect(names).toContain('User');
      expect(names).toContain('Session');
    });

    test('should combine include and exclude patterns', () => {
      const program = transformDatabase(testMetadata, {
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
      const program = transformDatabase(testMetadata, {
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
});
