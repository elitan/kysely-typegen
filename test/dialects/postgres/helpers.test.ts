import { describe, expect, it } from 'bun:test';
import { HELPER_DEFINITIONS, HELPER_NAMES, isHelperType } from '@/dialects/postgres/helpers';
import { serialize } from '@/ast/serialize';

describe('postgres helpers', () => {
  describe('HELPER_DEFINITIONS', () => {
    it('should define Timestamp helper', () => {
      const timestamp = HELPER_DEFINITIONS.Timestamp;
      expect(timestamp).toBeDefined();
      expect(timestamp.kind).toBe('typeAlias');
      expect(timestamp.name).toBe('Timestamp');
      expect(timestamp.exported).toBe(true);
    });

    it('should define Int8 helper', () => {
      const int8 = HELPER_DEFINITIONS.Int8;
      expect(int8).toBeDefined();
      expect(int8.name).toBe('Int8');
    });

    it('should define Numeric helper', () => {
      const numeric = HELPER_DEFINITIONS.Numeric;
      expect(numeric).toBeDefined();
      expect(numeric.name).toBe('Numeric');
    });

    it('should define Interval helper', () => {
      const interval = HELPER_DEFINITIONS.Interval;
      expect(interval).toBeDefined();
      expect(interval.name).toBe('Interval');
    });

    it('should define Point helper', () => {
      const point = HELPER_DEFINITIONS.Point;
      expect(point).toBeDefined();
      expect(point.name).toBe('Point');
    });

    it('should define Circle helper', () => {
      const circle = HELPER_DEFINITIONS.Circle;
      expect(circle).toBeDefined();
      expect(circle.name).toBe('Circle');
    });
  });

  describe('serialization', () => {
    it('should serialize Timestamp correctly', () => {
      const result = serialize({ declarations: [HELPER_DEFINITIONS.Timestamp] });
      expect(result).toContain('export type Timestamp = ColumnType<Date, Date | string, Date | string>;');
    });

    it('should serialize Int8 correctly', () => {
      const result = serialize({ declarations: [HELPER_DEFINITIONS.Int8] });
      expect(result).toContain('export type Int8 = ColumnType<string, string | number | bigint, string | number | bigint>;');
    });

    it('should serialize Numeric correctly', () => {
      const result = serialize({ declarations: [HELPER_DEFINITIONS.Numeric] });
      expect(result).toContain('export type Numeric = ColumnType<string, number | string, number | string>;');
    });

    it('should serialize Interval correctly', () => {
      const result = serialize({ declarations: [HELPER_DEFINITIONS.Interval] });
      expect(result).toContain('export type Interval = ColumnType<IPostgresInterval, IPostgresInterval | string, IPostgresInterval | string>;');
    });

    it('should serialize Point correctly', () => {
      const result = serialize({ declarations: [HELPER_DEFINITIONS.Point] });
      expect(result).toContain('export type Point = { x: number; y: number };');
    });

    it('should serialize Circle correctly', () => {
      const result = serialize({ declarations: [HELPER_DEFINITIONS.Circle] });
      expect(result).toContain('export type Circle = { x: number; y: number; radius: number };');
    });
  });

  describe('HELPER_NAMES', () => {
    it('should contain all helper names', () => {
      expect(HELPER_NAMES).toContain('Timestamp');
      expect(HELPER_NAMES).toContain('Int8');
      expect(HELPER_NAMES).toContain('Numeric');
      expect(HELPER_NAMES).toContain('Interval');
      expect(HELPER_NAMES).toContain('Point');
      expect(HELPER_NAMES).toContain('Circle');
    });
  });

  describe('isHelperType', () => {
    it('should return true for helper types', () => {
      expect(isHelperType('Timestamp')).toBe(true);
      expect(isHelperType('Int8')).toBe(true);
      expect(isHelperType('Numeric')).toBe(true);
      expect(isHelperType('Interval')).toBe(true);
      expect(isHelperType('Point')).toBe(true);
      expect(isHelperType('Circle')).toBe(true);
    });

    it('should return false for non-helper types', () => {
      expect(isHelperType('string')).toBe(false);
      expect(isHelperType('number')).toBe(false);
      expect(isHelperType('Date')).toBe(false);
      expect(isHelperType('CustomType')).toBe(false);
    });
  });
});
