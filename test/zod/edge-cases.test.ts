import { describe, expect, test } from 'bun:test';
import { serializeZodSchema, serializeZod } from '@/zod/serialize';
import { transformDatabaseToZod } from '@/zod/transform';
import type { DatabaseMetadata } from '@/introspect/types';
import type { ZodProgramNode } from '@/zod/nodes';

describe('Zod edge cases', () => {
  describe('reserved word property names', () => {
    test('should quote reserved word property names', () => {
      const result = serializeZodSchema({
        kind: 'zod-object',
        properties: [
          { name: 'class', schema: { kind: 'zod-primitive', method: 'string' } },
          { name: 'function', schema: { kind: 'zod-primitive', method: 'string' } },
          { name: 'default', schema: { kind: 'zod-primitive', method: 'string' } },
          { name: 'import', schema: { kind: 'zod-primitive', method: 'string' } },
          { name: 'export', schema: { kind: 'zod-primitive', method: 'string' } },
        ],
      });

      expect(result).toContain("'class': z.string()");
      expect(result).toContain("'function': z.string()");
      expect(result).toContain("'default': z.string()");
      expect(result).toContain("'import': z.string()");
      expect(result).toContain("'export': z.string()");
    });

    test('should not quote regular property names', () => {
      const result = serializeZodSchema({
        kind: 'zod-object',
        properties: [
          { name: 'id', schema: { kind: 'zod-primitive', method: 'number' } },
          { name: 'userName', schema: { kind: 'zod-primitive', method: 'string' } },
        ],
      });

      expect(result).toContain('id: z.number()');
      expect(result).toContain('userName: z.string()');
      expect(result).not.toContain("'id'");
      expect(result).not.toContain("'userName'");
    });
  });

  describe('special characters in property names', () => {
    test('should quote property names with hyphens', () => {
      const result = serializeZodSchema({
        kind: 'zod-object',
        properties: [
          { name: 'created-at', schema: { kind: 'zod-primitive', method: 'date' } },
          { name: 'user-id', schema: { kind: 'zod-primitive', method: 'number' } },
        ],
      });

      expect(result).toContain("'created-at': z.date()");
      expect(result).toContain("'user-id': z.number()");
    });

    test('should quote property names starting with digits', () => {
      const result = serializeZodSchema({
        kind: 'zod-object',
        properties: [
          { name: '123column', schema: { kind: 'zod-primitive', method: 'string' } },
          { name: '0index', schema: { kind: 'zod-primitive', method: 'number' } },
        ],
      });

      expect(result).toContain("'123column': z.string()");
      expect(result).toContain("'0index': z.number()");
    });

    test('should quote property names with spaces', () => {
      const result = serializeZodSchema({
        kind: 'zod-object',
        properties: [
          { name: 'column name', schema: { kind: 'zod-primitive', method: 'string' } },
        ],
      });

      expect(result).toContain("'column name': z.string()");
    });
  });

  describe('special characters in enum values', () => {
    test('should escape apostrophes in enum values', () => {
      const result = serializeZodSchema({
        kind: 'zod-enum',
        values: ["it's", "don't", "won't"],
      });

      expect(result).toContain("'it\\'s'");
      expect(result).toContain("'don\\'t'");
      expect(result).toContain("'won\\'t'");
    });

    test('should escape backslashes in enum values', () => {
      const result = serializeZodSchema({
        kind: 'zod-enum',
        values: ['path\\to\\file', 'C:\\Users'],
      });

      expect(result).toContain("'path\\\\to\\\\file'");
      expect(result).toContain("'C:\\\\Users'");
    });

    test('should escape newlines in enum values', () => {
      const result = serializeZodSchema({
        kind: 'zod-enum',
        values: ['line1\nline2'],
      });

      expect(result).toContain("'line1\\nline2'");
    });
  });

  describe('special characters in literals', () => {
    test('should escape special chars in literal values', () => {
      expect(serializeZodSchema({ kind: 'zod-literal', value: "it's" }))
        .toBe("z.literal('it\\'s')");

      expect(serializeZodSchema({ kind: 'zod-literal', value: 'path\\file' }))
        .toBe("z.literal('path\\\\file')");
    });
  });

  describe('table transformation edge cases', () => {
    test('should handle table with reserved word column names', () => {
      const metadata: DatabaseMetadata = {
        tables: [{
          schema: 'public',
          name: 'configs',
          columns: [
            { name: 'class', dataType: 'varchar', isNullable: false, isAutoIncrement: false, hasDefaultValue: false },
            { name: 'default', dataType: 'varchar', isNullable: true, isAutoIncrement: false, hasDefaultValue: false },
          ],
        }],
        enums: [],
      };

      const program = transformDatabaseToZod(metadata);
      const code = serializeZod(program);

      expect(code).toContain("'class': z.string()");
      expect(code).toContain("'default': z.string().nullable()");
    });

    test('should handle empty table (no columns)', () => {
      const metadata: DatabaseMetadata = {
        tables: [{
          schema: 'public',
          name: 'empty_table',
          columns: [],
        }],
        enums: [],
      };

      const program = transformDatabaseToZod(metadata);
      const code = serializeZod(program);

      expect(code).toContain('export const emptyTableSchema = z.object({})');
    });

    test('should handle table with all auto-increment columns', () => {
      const metadata: DatabaseMetadata = {
        tables: [{
          schema: 'public',
          name: 'auto_only',
          columns: [
            { name: 'id', dataType: 'int4', isNullable: false, isAutoIncrement: true, hasDefaultValue: true },
            { name: 'seq', dataType: 'int4', isNullable: false, isAutoIncrement: true, hasDefaultValue: true },
          ],
        }],
        enums: [],
      };

      const program = transformDatabaseToZod(metadata);
      const code = serializeZod(program);

      expect(code).toContain('newAutoOnlySchema');
      expect(code).toContain('id: z.number().optional()');
      expect(code).toContain('seq: z.number().optional()');
    });

    test('should handle table with all nullable columns', () => {
      const metadata: DatabaseMetadata = {
        tables: [{
          schema: 'public',
          name: 'all_nullable',
          columns: [
            { name: 'a', dataType: 'varchar', isNullable: true, isAutoIncrement: false, hasDefaultValue: false },
            { name: 'b', dataType: 'int4', isNullable: true, isAutoIncrement: false, hasDefaultValue: false },
          ],
        }],
        enums: [],
      };

      const program = transformDatabaseToZod(metadata);
      const code = serializeZod(program);

      expect(code).toContain('a: z.string().nullable()');
      expect(code).toContain('b: z.number().nullable()');
    });
  });
});
