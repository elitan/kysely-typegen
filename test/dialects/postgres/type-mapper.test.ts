import { describe, expect, it } from 'bun:test';
import { mapPostgresType } from '@/dialects/postgres/type-mapper';

describe('mapPostgresType', () => {
  describe('helper types', () => {
    it('should return Timestamp reference for timestamp', () => {
      const usedHelpers = new Set<string>();
      const result = mapPostgresType('timestamp', { isNullable: false, usedHelpers });
      expect(result).toEqual({ kind: 'reference', name: 'Timestamp' });
      expect(usedHelpers.has('Timestamp')).toBe(true);
    });

    it('should return Timestamp reference for timestamptz', () => {
      const usedHelpers = new Set<string>();
      const result = mapPostgresType('timestamptz', { isNullable: false, usedHelpers });
      expect(result).toEqual({ kind: 'reference', name: 'Timestamp' });
      expect(usedHelpers.has('Timestamp')).toBe(true);
    });

    it('should return Timestamp reference for date', () => {
      const usedHelpers = new Set<string>();
      const result = mapPostgresType('date', { isNullable: false, usedHelpers });
      expect(result).toEqual({ kind: 'reference', name: 'Timestamp' });
      expect(usedHelpers.has('Timestamp')).toBe(true);
    });

    it('should return Int8 reference for int8', () => {
      const usedHelpers = new Set<string>();
      const result = mapPostgresType('int8', { isNullable: false, usedHelpers });
      expect(result).toEqual({ kind: 'reference', name: 'Int8' });
      expect(usedHelpers.has('Int8')).toBe(true);
    });

    it('should return Int8 reference for bigint', () => {
      const usedHelpers = new Set<string>();
      const result = mapPostgresType('bigint', { isNullable: false, usedHelpers });
      expect(result).toEqual({ kind: 'reference', name: 'Int8' });
      expect(usedHelpers.has('Int8')).toBe(true);
    });

    it('should return Numeric reference for numeric', () => {
      const usedHelpers = new Set<string>();
      const result = mapPostgresType('numeric', { isNullable: false, usedHelpers });
      expect(result).toEqual({ kind: 'reference', name: 'Numeric' });
      expect(usedHelpers.has('Numeric')).toBe(true);
    });

    it('should return Numeric reference for decimal', () => {
      const usedHelpers = new Set<string>();
      const result = mapPostgresType('decimal', { isNullable: false, usedHelpers });
      expect(result).toEqual({ kind: 'reference', name: 'Numeric' });
      expect(usedHelpers.has('Numeric')).toBe(true);
    });

    it('should return Interval reference for interval', () => {
      const usedHelpers = new Set<string>();
      const result = mapPostgresType('interval', { isNullable: false, usedHelpers });
      expect(result).toEqual({ kind: 'reference', name: 'Interval' });
      expect(usedHelpers.has('Interval')).toBe(true);
    });

    it('should return Point reference for point', () => {
      const usedHelpers = new Set<string>();
      const result = mapPostgresType('point', { isNullable: false, usedHelpers });
      expect(result).toEqual({ kind: 'reference', name: 'Point' });
      expect(usedHelpers.has('Point')).toBe(true);
    });

    it('should return Circle reference for circle', () => {
      const usedHelpers = new Set<string>();
      const result = mapPostgresType('circle', { isNullable: false, usedHelpers });
      expect(result).toEqual({ kind: 'reference', name: 'Circle' });
      expect(usedHelpers.has('Circle')).toBe(true);
    });
  });

  describe('nullable helper types', () => {
    it('should wrap Timestamp in union with null when nullable', () => {
      const usedHelpers = new Set<string>();
      const result = mapPostgresType('timestamp', { isNullable: true, usedHelpers });
      expect(result).toEqual({
        kind: 'union',
        types: [
          { kind: 'reference', name: 'Timestamp' },
          { kind: 'primitive', value: 'null' },
        ],
      });
      expect(usedHelpers.has('Timestamp')).toBe(true);
    });

    it('should wrap Int8 in union with null when nullable', () => {
      const usedHelpers = new Set<string>();
      const result = mapPostgresType('int8', { isNullable: true, usedHelpers });
      expect(result).toEqual({
        kind: 'union',
        types: [
          { kind: 'reference', name: 'Int8' },
          { kind: 'primitive', value: 'null' },
        ],
      });
    });
  });

  describe('array of helper types', () => {
    it('should handle timestamp arrays', () => {
      const usedHelpers = new Set<string>();
      const result = mapPostgresType('timestamp[]', { isNullable: false, usedHelpers });
      expect(result).toEqual({
        kind: 'generic',
        name: 'ArrayType',
        typeArguments: [{ kind: 'reference', name: 'Timestamp' }],
      });
      expect(usedHelpers.has('Timestamp')).toBe(true);
    });

    it('should handle int8 arrays', () => {
      const usedHelpers = new Set<string>();
      const result = mapPostgresType('int8[]', { isNullable: false, usedHelpers });
      expect(result).toEqual({
        kind: 'generic',
        name: 'ArrayType',
        typeArguments: [{ kind: 'reference', name: 'Int8' }],
      });
      expect(usedHelpers.has('Int8')).toBe(true);
    });
  });

  describe('primitive types', () => {
    it('should return number for int4', () => {
      const result = mapPostgresType('int4', { isNullable: false });
      expect(result).toEqual({ kind: 'primitive', value: 'number' });
    });

    it('should return number for integer', () => {
      const result = mapPostgresType('integer', { isNullable: false });
      expect(result).toEqual({ kind: 'primitive', value: 'number' });
    });

    it('should return string for varchar', () => {
      const result = mapPostgresType('varchar', { isNullable: false });
      expect(result).toEqual({ kind: 'primitive', value: 'string' });
    });

    it('should return boolean for bool', () => {
      const result = mapPostgresType('bool', { isNullable: false });
      expect(result).toEqual({ kind: 'primitive', value: 'boolean' });
    });

    it('should return string for time', () => {
      const result = mapPostgresType('time', { isNullable: false });
      expect(result).toEqual({ kind: 'primitive', value: 'string' });
    });
  });

  describe('no usedHelpers provided', () => {
    it('should still work without usedHelpers set', () => {
      const result = mapPostgresType('timestamp', { isNullable: false });
      expect(result).toEqual({ kind: 'reference', name: 'Timestamp' });
    });
  });
});
