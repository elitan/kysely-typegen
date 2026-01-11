import { describe, expect, test } from 'bun:test';
import type { DatabaseMetadata } from '@/introspect/types';
import { transformDatabaseToZod } from '@/zod/transform';
import { serializeZod } from '@/zod/serialize';

describe('transformDatabaseToZod', () => {
  test('should generate import statement', () => {
    const metadata: DatabaseMetadata = { tables: [], enums: [] };
    const program = transformDatabaseToZod(metadata);
    expect(program.declarations[0]).toEqual({ kind: 'zod-import' });
  });

  test('should generate enum schema', () => {
    const metadata: DatabaseMetadata = {
      tables: [],
      enums: [{ schema: 'public', name: 'status', values: ['pending', 'approved', 'rejected'] }],
    };
    const program = transformDatabaseToZod(metadata);
    expect(program.declarations[1]).toEqual({
      kind: 'zod-schema-declaration',
      name: 'statusSchema',
      schema: { kind: 'zod-enum', values: ['pending', 'approved', 'rejected'] },
      exported: true,
    });
  });

  test('should generate select schema for table', () => {
    const metadata: DatabaseMetadata = {
      tables: [
        {
          schema: 'public',
          name: 'users',
          columns: [
            { name: 'id', dataType: 'int4', isNullable: false, isAutoIncrement: true, hasDefaultValue: true },
            { name: 'email', dataType: 'varchar', isNullable: false, isAutoIncrement: false, hasDefaultValue: false },
          ],
        },
      ],
      enums: [],
    };
    const program = transformDatabaseToZod(metadata);

    const selectSchema = program.declarations.find(
      (d) => d.kind === 'zod-schema-declaration' && d.name === 'userSchema'
    );
    expect(selectSchema).toBeDefined();
    expect(selectSchema?.kind).toBe('zod-schema-declaration');
    if (selectSchema?.kind === 'zod-schema-declaration') {
      expect(selectSchema.schema.kind).toBe('zod-object');
    }
  });

  test('should generate insert schema with optional auto-increment fields', () => {
    const metadata: DatabaseMetadata = {
      tables: [
        {
          schema: 'public',
          name: 'users',
          columns: [
            { name: 'id', dataType: 'int4', isNullable: false, isAutoIncrement: true, hasDefaultValue: true },
            { name: 'email', dataType: 'varchar', isNullable: false, isAutoIncrement: false, hasDefaultValue: false },
          ],
        },
      ],
      enums: [],
    };
    const program = transformDatabaseToZod(metadata);

    const insertSchema = program.declarations.find(
      (d) => d.kind === 'zod-schema-declaration' && d.name === 'newUserSchema'
    );
    expect(insertSchema).toBeDefined();
    if (insertSchema?.kind === 'zod-schema-declaration' && insertSchema.schema.kind === 'zod-object') {
      const idProp = insertSchema.schema.properties.find((p) => p.name === 'id');
      expect(idProp?.schema.kind).toBe('zod-modified');
      if (idProp?.schema.kind === 'zod-modified') {
        expect(idProp.schema.modifiers).toContain('optional');
      }
    }
  });

  test('should generate update schema with all fields optional', () => {
    const metadata: DatabaseMetadata = {
      tables: [
        {
          schema: 'public',
          name: 'users',
          columns: [
            { name: 'id', dataType: 'int4', isNullable: false, isAutoIncrement: true, hasDefaultValue: true },
            { name: 'email', dataType: 'varchar', isNullable: false, isAutoIncrement: false, hasDefaultValue: false },
          ],
        },
      ],
      enums: [],
    };
    const program = transformDatabaseToZod(metadata);

    const updateSchema = program.declarations.find(
      (d) => d.kind === 'zod-schema-declaration' && d.name === 'userUpdateSchema'
    );
    expect(updateSchema).toBeDefined();
    if (updateSchema?.kind === 'zod-schema-declaration' && updateSchema.schema.kind === 'zod-object') {
      for (const prop of updateSchema.schema.properties) {
        expect(prop.schema.kind).toBe('zod-modified');
        if (prop.schema.kind === 'zod-modified') {
          expect(prop.schema.modifiers).toContain('optional');
        }
      }
    }
  });

  test('should generate infer exports', () => {
    const metadata: DatabaseMetadata = {
      tables: [
        {
          schema: 'public',
          name: 'users',
          columns: [
            { name: 'id', dataType: 'int4', isNullable: false, isAutoIncrement: true, hasDefaultValue: true },
          ],
        },
      ],
      enums: [],
    };
    const program = transformDatabaseToZod(metadata);

    const inferExports = program.declarations.filter((d) => d.kind === 'zod-infer-export');
    expect(inferExports.length).toBe(3);

    const typeNames = inferExports.map((d) => (d as { typeName: string }).typeName);
    expect(typeNames).toContain('User');
    expect(typeNames).toContain('NewUser');
    expect(typeNames).toContain('UserUpdate');
  });

  test('should handle nullable columns', () => {
    const metadata: DatabaseMetadata = {
      tables: [
        {
          schema: 'public',
          name: 'users',
          columns: [
            { name: 'bio', dataType: 'text', isNullable: true, isAutoIncrement: false, hasDefaultValue: false },
          ],
        },
      ],
      enums: [],
    };
    const program = transformDatabaseToZod(metadata);

    const selectSchema = program.declarations.find(
      (d) => d.kind === 'zod-schema-declaration' && d.name === 'userSchema'
    );
    if (selectSchema?.kind === 'zod-schema-declaration' && selectSchema.schema.kind === 'zod-object') {
      const bioProp = selectSchema.schema.properties.find((p) => p.name === 'bio');
      expect(bioProp?.schema.kind).toBe('zod-modified');
      if (bioProp?.schema.kind === 'zod-modified') {
        expect(bioProp.schema.modifiers).toContain('nullable');
      }
    }
  });

  test('should handle enum columns', () => {
    const metadata: DatabaseMetadata = {
      tables: [
        {
          schema: 'public',
          name: 'users',
          columns: [
            { name: 'status', dataType: 'user_status', dataTypeSchema: 'public', isNullable: false, isAutoIncrement: false, hasDefaultValue: false },
          ],
        },
      ],
      enums: [{ schema: 'public', name: 'user_status', values: ['active', 'inactive'] }],
    };
    const program = transformDatabaseToZod(metadata);

    const selectSchema = program.declarations.find(
      (d) => d.kind === 'zod-schema-declaration' && d.name === 'userSchema'
    );
    if (selectSchema?.kind === 'zod-schema-declaration' && selectSchema.schema.kind === 'zod-object') {
      const statusProp = selectSchema.schema.properties.find((p) => p.name === 'status');
      expect(statusProp?.schema.kind).toBe('zod-reference');
      if (statusProp?.schema.kind === 'zod-reference') {
        expect(statusProp.schema.name).toBe('userStatusSchema');
      }
    }
  });

  test('should apply camelCase option', () => {
    const metadata: DatabaseMetadata = {
      tables: [
        {
          schema: 'public',
          name: 'user_profiles',
          columns: [
            { name: 'created_at', dataType: 'timestamp', isNullable: false, isAutoIncrement: false, hasDefaultValue: true },
          ],
        },
      ],
      enums: [],
    };
    const program = transformDatabaseToZod(metadata, { camelCase: true });

    const selectSchema = program.declarations.find(
      (d) => d.kind === 'zod-schema-declaration' && d.name === 'userProfileSchema'
    );
    if (selectSchema?.kind === 'zod-schema-declaration' && selectSchema.schema.kind === 'zod-object') {
      const prop = selectSchema.schema.properties[0];
      expect(prop.name).toBe('createdAt');
    }
  });

  test('should serialize complete output', () => {
    const metadata: DatabaseMetadata = {
      tables: [
        {
          schema: 'public',
          name: 'users',
          columns: [
            { name: 'id', dataType: 'int4', isNullable: false, isAutoIncrement: true, hasDefaultValue: true },
            { name: 'email', dataType: 'varchar', isNullable: false, isAutoIncrement: false, hasDefaultValue: false },
            { name: 'name', dataType: 'varchar', isNullable: true, isAutoIncrement: false, hasDefaultValue: false },
            { name: 'created_at', dataType: 'timestamp', isNullable: false, isAutoIncrement: false, hasDefaultValue: true },
          ],
        },
      ],
      enums: [],
    };
    const program = transformDatabaseToZod(metadata);
    const code = serializeZod(program);

    expect(code).toContain("import { z } from 'zod';");
    expect(code).toContain('export const userSchema = z.object({');
    expect(code).toContain('export const newUserSchema = z.object({');
    expect(code).toContain('export const userUpdateSchema = z.object({');
    expect(code).toContain('export type User = z.infer<typeof userSchema>;');
    expect(code).toContain('export type NewUser = z.infer<typeof newUserSchema>;');
    expect(code).toContain('export type UserUpdate = z.infer<typeof userUpdateSchema>;');
  });

  test('should generate transform for boolean CHECK constraints by default', () => {
    const metadata: DatabaseMetadata = {
      tables: [
        {
          schema: 'public',
          name: 'settings',
          columns: [
            {
              name: 'is_enabled',
              dataType: 'integer',
              isNullable: false,
              isAutoIncrement: false,
              hasDefaultValue: false,
              checkConstraint: { type: 'boolean' },
            },
          ],
        },
      ],
      enums: [],
    };
    const program = transformDatabaseToZod(metadata);
    const code = serializeZod(program);

    expect(code).toContain('z.union([z.literal(0), z.literal(1)]).transform(v => v === 1)');
  });

  test('should generate union without transform when noBooleanCoerce is true', () => {
    const metadata: DatabaseMetadata = {
      tables: [
        {
          schema: 'public',
          name: 'settings',
          columns: [
            {
              name: 'is_enabled',
              dataType: 'integer',
              isNullable: false,
              isAutoIncrement: false,
              hasDefaultValue: false,
              checkConstraint: { type: 'boolean' },
            },
          ],
        },
      ],
      enums: [],
    };
    const program = transformDatabaseToZod(metadata, { noBooleanCoerce: true });
    const code = serializeZod(program);

    expect(code).toContain('z.union([z.literal(0), z.literal(1)])');
    expect(code).not.toContain('.transform(v => v === 1)');
  });

  test('should handle nullable boolean CHECK constraints with transform', () => {
    const metadata: DatabaseMetadata = {
      tables: [
        {
          schema: 'public',
          name: 'settings',
          columns: [
            {
              name: 'is_public',
              dataType: 'integer',
              isNullable: true,
              isAutoIncrement: false,
              hasDefaultValue: false,
              checkConstraint: { type: 'boolean' },
            },
          ],
        },
      ],
      enums: [],
    };
    const program = transformDatabaseToZod(metadata);
    const code = serializeZod(program);

    expect(code).toContain('z.union([z.literal(0), z.literal(1)]).transform(v => v === 1).nullable()');
  });
});
