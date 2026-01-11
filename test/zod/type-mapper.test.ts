import { describe, expect, it } from 'bun:test';
import { mapPostgresTypeToZod } from '@/zod/type-mapper';

describe('mapPostgresTypeToZod', () => {
  describe('integer types', () => {
    it('should return z.number() for int4', () => {
      const result = mapPostgresTypeToZod('int4', { isNullable: false, mode: 'select' });
      expect(result).toEqual({ kind: 'zod-primitive', method: 'number' });
    });

    it('should return z.number() for integer', () => {
      const result = mapPostgresTypeToZod('integer', { isNullable: false, mode: 'select' });
      expect(result).toEqual({ kind: 'zod-primitive', method: 'number' });
    });

    it('should return z.number() for smallint', () => {
      const result = mapPostgresTypeToZod('smallint', { isNullable: false, mode: 'select' });
      expect(result).toEqual({ kind: 'zod-primitive', method: 'number' });
    });
  });

  describe('bigint types', () => {
    it('should return z.string() for bigint in select mode', () => {
      const result = mapPostgresTypeToZod('bigint', { isNullable: false, mode: 'select' });
      expect(result).toEqual({ kind: 'zod-primitive', method: 'string' });
    });

    it('should return union for bigint in insert mode', () => {
      const result = mapPostgresTypeToZod('bigint', { isNullable: false, mode: 'insert' });
      expect(result).toEqual({
        kind: 'zod-union',
        schemas: [
          { kind: 'zod-primitive', method: 'string' },
          { kind: 'zod-primitive', method: 'number' },
          { kind: 'zod-primitive', method: 'bigint' },
        ],
      });
    });

    it('should return union for int8 in update mode', () => {
      const result = mapPostgresTypeToZod('int8', { isNullable: false, mode: 'update' });
      expect(result).toEqual({
        kind: 'zod-union',
        schemas: [
          { kind: 'zod-primitive', method: 'string' },
          { kind: 'zod-primitive', method: 'number' },
          { kind: 'zod-primitive', method: 'bigint' },
        ],
      });
    });
  });

  describe('numeric types', () => {
    it('should return z.string() for numeric in select mode', () => {
      const result = mapPostgresTypeToZod('numeric', { isNullable: false, mode: 'select' });
      expect(result).toEqual({ kind: 'zod-primitive', method: 'string' });
    });

    it('should return union for numeric in insert mode', () => {
      const result = mapPostgresTypeToZod('decimal', { isNullable: false, mode: 'insert' });
      expect(result).toEqual({
        kind: 'zod-union',
        schemas: [
          { kind: 'zod-primitive', method: 'string' },
          { kind: 'zod-primitive', method: 'number' },
        ],
      });
    });
  });

  describe('string types', () => {
    it('should return z.string() for varchar', () => {
      const result = mapPostgresTypeToZod('varchar', { isNullable: false, mode: 'select' });
      expect(result).toEqual({ kind: 'zod-primitive', method: 'string' });
    });

    it('should return z.string() for text', () => {
      const result = mapPostgresTypeToZod('text', { isNullable: false, mode: 'select' });
      expect(result).toEqual({ kind: 'zod-primitive', method: 'string' });
    });

    it('should return z.string() for uuid', () => {
      const result = mapPostgresTypeToZod('uuid', { isNullable: false, mode: 'select' });
      expect(result).toEqual({ kind: 'zod-primitive', method: 'string' });
    });
  });

  describe('boolean types', () => {
    it('should return z.boolean() for bool', () => {
      const result = mapPostgresTypeToZod('bool', { isNullable: false, mode: 'select' });
      expect(result).toEqual({ kind: 'zod-primitive', method: 'boolean' });
    });

    it('should return z.boolean() for boolean', () => {
      const result = mapPostgresTypeToZod('boolean', { isNullable: false, mode: 'select' });
      expect(result).toEqual({ kind: 'zod-primitive', method: 'boolean' });
    });
  });

  describe('timestamp types', () => {
    it('should return z.date() for timestamp in select mode', () => {
      const result = mapPostgresTypeToZod('timestamp', { isNullable: false, mode: 'select' });
      expect(result).toEqual({ kind: 'zod-primitive', method: 'date' });
    });

    it('should return z.date() for timestamptz in select mode', () => {
      const result = mapPostgresTypeToZod('timestamptz', { isNullable: false, mode: 'select' });
      expect(result).toEqual({ kind: 'zod-primitive', method: 'date' });
    });

    it('should return union for timestamp in insert mode', () => {
      const result = mapPostgresTypeToZod('timestamp', { isNullable: false, mode: 'insert' });
      expect(result).toEqual({
        kind: 'zod-union',
        schemas: [
          { kind: 'zod-primitive', method: 'date' },
          { kind: 'zod-primitive', method: 'string' },
        ],
      });
    });

    it('should return union for date in update mode', () => {
      const result = mapPostgresTypeToZod('date', { isNullable: false, mode: 'update' });
      expect(result).toEqual({
        kind: 'zod-union',
        schemas: [
          { kind: 'zod-primitive', method: 'date' },
          { kind: 'zod-primitive', method: 'string' },
        ],
      });
    });
  });

  describe('json types', () => {
    it('should return z.unknown() for json', () => {
      const result = mapPostgresTypeToZod('json', { isNullable: false, mode: 'select' });
      expect(result).toEqual({ kind: 'zod-primitive', method: 'unknown' });
    });

    it('should return z.unknown() for jsonb', () => {
      const result = mapPostgresTypeToZod('jsonb', { isNullable: false, mode: 'select' });
      expect(result).toEqual({ kind: 'zod-primitive', method: 'unknown' });
    });
  });

  describe('geometry types', () => {
    it('should return point object schema', () => {
      const result = mapPostgresTypeToZod('point', { isNullable: false, mode: 'select' });
      expect(result).toEqual({
        kind: 'zod-object',
        properties: [
          { name: 'x', schema: { kind: 'zod-primitive', method: 'number' } },
          { name: 'y', schema: { kind: 'zod-primitive', method: 'number' } },
        ],
      });
    });

    it('should return circle object schema', () => {
      const result = mapPostgresTypeToZod('circle', { isNullable: false, mode: 'select' });
      expect(result).toEqual({
        kind: 'zod-object',
        properties: [
          { name: 'x', schema: { kind: 'zod-primitive', method: 'number' } },
          { name: 'y', schema: { kind: 'zod-primitive', method: 'number' } },
          { name: 'radius', schema: { kind: 'zod-primitive', method: 'number' } },
        ],
      });
    });
  });

  describe('bytea type', () => {
    it('should return custom Buffer type', () => {
      const result = mapPostgresTypeToZod('bytea', { isNullable: false, mode: 'select' });
      expect(result).toEqual({ kind: 'zod-custom', typeReference: 'Buffer' });
    });
  });

  describe('nullable handling', () => {
    it('should add nullable modifier when isNullable is true', () => {
      const result = mapPostgresTypeToZod('varchar', { isNullable: true, mode: 'select' });
      expect(result).toEqual({
        kind: 'zod-modified',
        schema: { kind: 'zod-primitive', method: 'string' },
        modifiers: ['nullable'],
      });
    });
  });

  describe('optional handling', () => {
    it('should add optional modifier when isOptional is true', () => {
      const result = mapPostgresTypeToZod('varchar', { isNullable: false, isOptional: true, mode: 'select' });
      expect(result).toEqual({
        kind: 'zod-modified',
        schema: { kind: 'zod-primitive', method: 'string' },
        modifiers: ['optional'],
      });
    });

    it('should add both nullable and optional modifiers', () => {
      const result = mapPostgresTypeToZod('varchar', { isNullable: true, isOptional: true, mode: 'select' });
      expect(result).toEqual({
        kind: 'zod-modified',
        schema: { kind: 'zod-primitive', method: 'string' },
        modifiers: ['nullable', 'optional'],
      });
    });
  });

  describe('array handling', () => {
    it('should handle string arrays', () => {
      const result = mapPostgresTypeToZod('varchar[]', { isNullable: false, mode: 'select' });
      expect(result).toEqual({
        kind: 'zod-array',
        element: { kind: 'zod-primitive', method: 'string' },
      });
    });

    it('should handle integer arrays', () => {
      const result = mapPostgresTypeToZod('int4', { isNullable: false, isArray: true, mode: 'select' });
      expect(result).toEqual({
        kind: 'zod-array',
        element: { kind: 'zod-primitive', method: 'number' },
      });
    });

    it('should handle nullable arrays', () => {
      const result = mapPostgresTypeToZod('varchar[]', { isNullable: true, mode: 'select' });
      expect(result).toEqual({
        kind: 'zod-modified',
        schema: {
          kind: 'zod-array',
          element: { kind: 'zod-primitive', method: 'string' },
        },
        modifiers: ['nullable'],
      });
    });
  });

  describe('unknown types', () => {
    it('should return z.unknown() for unrecognized types', () => {
      const result = mapPostgresTypeToZod('some_custom_type', { isNullable: false, mode: 'select' });
      expect(result).toEqual({ kind: 'zod-primitive', method: 'unknown' });
    });
  });
});
