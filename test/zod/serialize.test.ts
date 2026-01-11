import { describe, expect, test } from 'bun:test';
import type { ZodProgramNode, ZodSchemaNode } from '@/zod/nodes';
import { serializeZodSchema, serializeZod } from '@/zod/serialize';

describe('Zod Serializer', () => {
  describe('serializeZodSchema', () => {
    test('should serialize primitive types', () => {
      expect(serializeZodSchema({ kind: 'zod-primitive', method: 'string' })).toBe('z.string()');
      expect(serializeZodSchema({ kind: 'zod-primitive', method: 'number' })).toBe('z.number()');
      expect(serializeZodSchema({ kind: 'zod-primitive', method: 'boolean' })).toBe('z.boolean()');
      expect(serializeZodSchema({ kind: 'zod-primitive', method: 'date' })).toBe('z.date()');
      expect(serializeZodSchema({ kind: 'zod-primitive', method: 'unknown' })).toBe('z.unknown()');
    });

    test('should serialize string literals', () => {
      expect(serializeZodSchema({ kind: 'zod-literal', value: 'active' })).toBe("z.literal('active')");
    });

    test('should serialize number literals', () => {
      expect(serializeZodSchema({ kind: 'zod-literal', value: 42 })).toBe('z.literal(42)');
    });

    test('should serialize boolean literals', () => {
      expect(serializeZodSchema({ kind: 'zod-literal', value: true })).toBe('z.literal(true)');
    });

    test('should serialize enums', () => {
      expect(serializeZodSchema({
        kind: 'zod-enum',
        values: ['pending', 'approved', 'rejected'],
      })).toBe("z.enum(['pending', 'approved', 'rejected'])");
    });

    test('should serialize unions', () => {
      expect(serializeZodSchema({
        kind: 'zod-union',
        schemas: [
          { kind: 'zod-primitive', method: 'date' },
          { kind: 'zod-primitive', method: 'string' },
        ],
      })).toBe('z.union([z.date(), z.string()])');
    });

    test('should serialize arrays', () => {
      expect(serializeZodSchema({
        kind: 'zod-array',
        element: { kind: 'zod-primitive', method: 'string' },
      })).toBe('z.array(z.string())');
    });

    test('should serialize empty objects', () => {
      expect(serializeZodSchema({ kind: 'zod-object', properties: [] })).toBe('z.object({})');
    });

    test('should serialize objects with properties', () => {
      const result = serializeZodSchema({
        kind: 'zod-object',
        properties: [
          { name: 'id', schema: { kind: 'zod-primitive', method: 'number' } },
          { name: 'email', schema: { kind: 'zod-primitive', method: 'string' } },
        ],
      });
      expect(result).toContain('z.object({');
      expect(result).toContain('  id: z.number()');
      expect(result).toContain('  email: z.string()');
      expect(result).toContain('})');
    });

    test('should serialize nullable modifier', () => {
      expect(serializeZodSchema({
        kind: 'zod-modified',
        schema: { kind: 'zod-primitive', method: 'string' },
        modifiers: ['nullable'],
      })).toBe('z.string().nullable()');
    });

    test('should serialize optional modifier', () => {
      expect(serializeZodSchema({
        kind: 'zod-modified',
        schema: { kind: 'zod-primitive', method: 'string' },
        modifiers: ['optional'],
      })).toBe('z.string().optional()');
    });

    test('should serialize nullable and optional together', () => {
      expect(serializeZodSchema({
        kind: 'zod-modified',
        schema: { kind: 'zod-primitive', method: 'string' },
        modifiers: ['nullable', 'optional'],
      })).toBe('z.string().nullable().optional()');
    });

    test('should serialize references', () => {
      expect(serializeZodSchema({ kind: 'zod-reference', name: 'statusSchema' })).toBe('statusSchema');
    });

    test('should serialize custom types', () => {
      expect(serializeZodSchema({ kind: 'zod-custom', typeReference: 'Buffer' })).toBe('z.custom<Buffer>()');
    });

    test('should serialize transform', () => {
      expect(serializeZodSchema({
        kind: 'zod-transform',
        schema: {
          kind: 'zod-union',
          schemas: [
            { kind: 'zod-literal', value: 0 },
            { kind: 'zod-literal', value: 1 },
          ],
        },
        transformFn: 'v => v === 1',
      })).toBe('z.union([z.literal(0), z.literal(1)]).transform(v => v === 1)');
    });

    test('should serialize transform with modifiers', () => {
      expect(serializeZodSchema({
        kind: 'zod-modified',
        schema: {
          kind: 'zod-transform',
          schema: {
            kind: 'zod-union',
            schemas: [
              { kind: 'zod-literal', value: 0 },
              { kind: 'zod-literal', value: 1 },
            ],
          },
          transformFn: 'v => v === 1',
        },
        modifiers: ['nullable'],
      })).toBe('z.union([z.literal(0), z.literal(1)]).transform(v => v === 1).nullable()');
    });

    test('should serialize coerce', () => {
      expect(serializeZodSchema({ kind: 'zod-coerce', method: 'boolean' })).toBe('z.coerce.boolean()');
      expect(serializeZodSchema({ kind: 'zod-coerce', method: 'string' })).toBe('z.coerce.string()');
      expect(serializeZodSchema({ kind: 'zod-coerce', method: 'number' })).toBe('z.coerce.number()');
    });

    test('should serialize coerce with modifiers', () => {
      expect(serializeZodSchema({
        kind: 'zod-modified',
        schema: { kind: 'zod-coerce', method: 'boolean' },
        modifiers: ['nullable'],
      })).toBe('z.coerce.boolean().nullable()');
    });
  });

  describe('serializeZod (full program)', () => {
    test('should serialize import', () => {
      const program: ZodProgramNode = {
        declarations: [{ kind: 'zod-import' }],
      };
      const result = serializeZod(program);
      expect(result).toContain("import { z } from 'zod';");
    });

    test('should serialize schema declaration', () => {
      const program: ZodProgramNode = {
        declarations: [
          {
            kind: 'zod-schema-declaration',
            name: 'userSchema',
            schema: {
              kind: 'zod-object',
              properties: [
                { name: 'id', schema: { kind: 'zod-primitive', method: 'number' } },
              ],
            },
            exported: true,
          },
        ],
      };
      const result = serializeZod(program);
      expect(result).toContain('export const userSchema = z.object({');
      expect(result).toContain('  id: z.number()');
    });

    test('should serialize infer export', () => {
      const program: ZodProgramNode = {
        declarations: [
          {
            kind: 'zod-infer-export',
            typeName: 'User',
            schemaName: 'userSchema',
          },
        ],
      };
      const result = serializeZod(program);
      expect(result).toContain('export type User = z.infer<typeof userSchema>;');
    });

    test('should serialize complete program', () => {
      const program: ZodProgramNode = {
        declarations: [
          { kind: 'zod-import' },
          {
            kind: 'zod-schema-declaration',
            name: 'userSchema',
            schema: {
              kind: 'zod-object',
              properties: [
                { name: 'id', schema: { kind: 'zod-primitive', method: 'number' } },
                { name: 'email', schema: { kind: 'zod-primitive', method: 'string' } },
                {
                  name: 'name',
                  schema: {
                    kind: 'zod-modified',
                    schema: { kind: 'zod-primitive', method: 'string' },
                    modifiers: ['nullable'],
                  },
                },
              ],
            },
            exported: true,
          },
          {
            kind: 'zod-infer-export',
            typeName: 'User',
            schemaName: 'userSchema',
          },
        ],
      };
      const result = serializeZod(program);
      expect(result).toContain("import { z } from 'zod';");
      expect(result).toContain('export const userSchema = z.object({');
      expect(result).toContain('export type User = z.infer<typeof userSchema>;');
    });
  });

  describe('property name quoting', () => {
    test('should quote property names with hyphens', () => {
      const result = serializeZodSchema({
        kind: 'zod-object',
        properties: [
          { name: 'created-at', schema: { kind: 'zod-primitive', method: 'string' } },
        ],
      });
      expect(result).toContain("'created-at': z.string()");
    });

    test('should quote reserved words', () => {
      const result = serializeZodSchema({
        kind: 'zod-object',
        properties: [
          { name: 'class', schema: { kind: 'zod-primitive', method: 'string' } },
        ],
      });
      expect(result).toContain("'class': z.string()");
    });
  });

  describe('string escaping', () => {
    test('should escape apostrophes in enum values', () => {
      const result = serializeZodSchema({
        kind: 'zod-enum',
        values: ["don't"],
      });
      expect(result).toBe("z.enum(['don\\'t'])");
    });

    test('should escape apostrophes in literals', () => {
      const result = serializeZodSchema({
        kind: 'zod-literal',
        value: "it's",
      });
      expect(result).toBe("z.literal('it\\'s')");
    });
  });
});
