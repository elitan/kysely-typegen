import { describe, expect, test } from 'bun:test';
import { mapSqliteType } from '@/dialects/sqlite/type-mapper';

describe('SQLite Type Mapper', () => {
  describe('integer types', () => {
    test('should map integer types to number', () => {
      expect(mapSqliteType('integer', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapSqliteType('int', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapSqliteType('tinyint', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapSqliteType('smallint', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapSqliteType('mediumint', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapSqliteType('bigint', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
    });
  });

  describe('real types', () => {
    test('should map real/double/float to number', () => {
      expect(mapSqliteType('real', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapSqliteType('double', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapSqliteType('float', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
    });
  });

  describe('numeric types', () => {
    test('should map numeric/decimal to number', () => {
      expect(mapSqliteType('numeric', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapSqliteType('decimal', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
    });
  });

  describe('text types', () => {
    test('should map text types to string', () => {
      expect(mapSqliteType('text', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapSqliteType('varchar', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapSqliteType('char', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapSqliteType('clob', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
    });
  });

  describe('blob type', () => {
    test('should map blob to Buffer', () => {
      expect(mapSqliteType('blob', { isNullable: false })).toEqual({ kind: 'primitive', value: 'Buffer' });
    });
  });

  describe('date types', () => {
    test('should map date types to string', () => {
      expect(mapSqliteType('date', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapSqliteType('datetime', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapSqliteType('timestamp', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
    });
  });

  describe('boolean type', () => {
    test('should map boolean to number (SQLite stores as 0/1)', () => {
      expect(mapSqliteType('boolean', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
    });
  });

  describe('json type', () => {
    test('should map json to JsonValue reference', () => {
      expect(mapSqliteType('json', { isNullable: false })).toEqual({ kind: 'reference', name: 'JsonValue' });
    });
  });

  describe('nullable types', () => {
    test('should wrap nullable types in union with null', () => {
      const result = mapSqliteType('integer', { isNullable: true });
      expect(result).toEqual({
        kind: 'union',
        types: [
          { kind: 'primitive', value: 'number' },
          { kind: 'primitive', value: 'null' },
        ],
      });
    });

    test('should wrap complex types in union with null', () => {
      const result = mapSqliteType('json', { isNullable: true });
      expect(result).toEqual({
        kind: 'union',
        types: [
          { kind: 'reference', name: 'JsonValue' },
          { kind: 'primitive', value: 'null' },
        ],
      });
    });
  });

  describe('unknown types', () => {
    test('should map unknown types to unknown', () => {
      expect(mapSqliteType('custom_type', { isNullable: false })).toEqual({ kind: 'primitive', value: 'unknown' });
    });

    test('should track unknown types', () => {
      const unknownTypes = new Set<string>();
      mapSqliteType('my_custom_type', { isNullable: false, unknownTypes });
      expect(unknownTypes.has('my_custom_type')).toBe(true);
    });
  });

  describe('case insensitivity', () => {
    test('should handle uppercase type names', () => {
      expect(mapSqliteType('INTEGER', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapSqliteType('TEXT', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapSqliteType('BLOB', { isNullable: false })).toEqual({ kind: 'primitive', value: 'Buffer' });
    });
  });
});
