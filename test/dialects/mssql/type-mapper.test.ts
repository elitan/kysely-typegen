import { describe, expect, test } from 'bun:test';
import { mapMssqlType } from '@/dialects/mssql/type-mapper';

describe('MSSQL Type Mapper', () => {
  describe('integer types', () => {
    test('should map integer types to number', () => {
      expect(mapMssqlType('tinyint', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapMssqlType('smallint', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapMssqlType('int', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapMssqlType('bigint', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
    });
  });

  describe('floating point types', () => {
    test('should map float/real to number', () => {
      expect(mapMssqlType('float', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapMssqlType('real', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
    });
  });

  describe('decimal types', () => {
    test('should map decimal/numeric/money to number', () => {
      expect(mapMssqlType('decimal', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapMssqlType('numeric', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapMssqlType('money', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapMssqlType('smallmoney', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
    });
  });

  describe('string types', () => {
    test('should map string types to string', () => {
      expect(mapMssqlType('char', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapMssqlType('varchar', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapMssqlType('nchar', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapMssqlType('nvarchar', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapMssqlType('text', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapMssqlType('ntext', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
    });

    test('should map uniqueidentifier to string', () => {
      expect(mapMssqlType('uniqueidentifier', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
    });

    test('should map xml to string', () => {
      expect(mapMssqlType('xml', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
    });
  });

  describe('binary types', () => {
    test('should map binary types to Buffer', () => {
      expect(mapMssqlType('binary', { isNullable: false })).toEqual({ kind: 'primitive', value: 'Buffer' });
      expect(mapMssqlType('varbinary', { isNullable: false })).toEqual({ kind: 'primitive', value: 'Buffer' });
      expect(mapMssqlType('image', { isNullable: false })).toEqual({ kind: 'primitive', value: 'Buffer' });
    });
  });

  describe('boolean type', () => {
    test('should map bit to boolean', () => {
      expect(mapMssqlType('bit', { isNullable: false })).toEqual({ kind: 'primitive', value: 'boolean' });
    });
  });

  describe('date/time types', () => {
    test('should map date/time types to Date', () => {
      expect(mapMssqlType('date', { isNullable: false })).toEqual({ kind: 'primitive', value: 'Date' });
      expect(mapMssqlType('datetime', { isNullable: false })).toEqual({ kind: 'primitive', value: 'Date' });
      expect(mapMssqlType('datetime2', { isNullable: false })).toEqual({ kind: 'primitive', value: 'Date' });
      expect(mapMssqlType('smalldatetime', { isNullable: false })).toEqual({ kind: 'primitive', value: 'Date' });
      expect(mapMssqlType('time', { isNullable: false })).toEqual({ kind: 'primitive', value: 'Date' });
      expect(mapMssqlType('datetimeoffset', { isNullable: false })).toEqual({ kind: 'primitive', value: 'Date' });
    });
  });

  describe('special types', () => {
    test('should map sql_variant to unknown', () => {
      expect(mapMssqlType('sql_variant', { isNullable: false })).toEqual({ kind: 'primitive', value: 'unknown' });
    });

    test('should map tvp to unknown', () => {
      expect(mapMssqlType('tvp', { isNullable: false })).toEqual({ kind: 'primitive', value: 'unknown' });
    });
  });

  describe('nullable types', () => {
    test('should wrap nullable types in union with null', () => {
      const result = mapMssqlType('int', { isNullable: true });
      expect(result).toEqual({
        kind: 'union',
        types: [
          { kind: 'primitive', value: 'number' },
          { kind: 'primitive', value: 'null' },
        ],
      });
    });

    test('should wrap Date types in union with null', () => {
      const result = mapMssqlType('datetime', { isNullable: true });
      expect(result).toEqual({
        kind: 'union',
        types: [
          { kind: 'primitive', value: 'Date' },
          { kind: 'primitive', value: 'null' },
        ],
      });
    });
  });

  describe('unknown types', () => {
    test('should map unknown types to unknown', () => {
      expect(mapMssqlType('custom_type', { isNullable: false })).toEqual({ kind: 'primitive', value: 'unknown' });
    });

    test('should track unknown types', () => {
      const unknownTypes = new Set<string>();
      mapMssqlType('my_custom_type', { isNullable: false, unknownTypes });
      expect(unknownTypes.has('my_custom_type')).toBe(true);
    });
  });

  describe('case insensitivity', () => {
    test('should handle uppercase type names', () => {
      expect(mapMssqlType('INT', { isNullable: false })).toEqual({ kind: 'primitive', value: 'number' });
      expect(mapMssqlType('VARCHAR', { isNullable: false })).toEqual({ kind: 'primitive', value: 'string' });
      expect(mapMssqlType('DATETIME2', { isNullable: false })).toEqual({ kind: 'primitive', value: 'Date' });
    });
  });
});
