import { describe, expect, test } from 'bun:test';
import { serialize } from '@/ast/serialize';
import { mapPostgresType } from '@/transform';

describe('ColumnType Support', () => {
  describe('Timestamp types', () => {
    test('should generate Timestamp reference for timestamp', () => {
      const result = mapPostgresType('timestamp', false);
      expect(result).toEqual({ kind: 'reference', name: 'Timestamp' });

      const serialized = serialize({
        declarations: [
          {
            kind: 'interface',
            name: 'TestInterface',
            properties: [{ name: 'ts', type: result, optional: false }],
            exported: true,
          },
        ],
      });

      expect(serialized).toContain('ts: Timestamp');
    });

    test('should handle nullable timestamp correctly', () => {
      const result = mapPostgresType('timestamp', true);
      const serialized = serialize({
        declarations: [
          {
            kind: 'interface',
            name: 'TestInterface',
            properties: [{ name: 'ts', type: result, optional: false }],
            exported: true,
          },
        ],
      });

      expect(serialized).toContain('ts: Timestamp | null');
    });
  });

  describe('Bigint types', () => {
    test('should generate Int8 reference for int8', () => {
      const result = mapPostgresType('int8', false);
      expect(result).toEqual({ kind: 'reference', name: 'Int8' });

      const serialized = serialize({
        declarations: [
          {
            kind: 'interface',
            name: 'TestInterface',
            properties: [{ name: 'bigint', type: result, optional: false }],
            exported: true,
          },
        ],
      });

      expect(serialized).toContain('bigint: Int8');
    });
  });

  describe('Numeric types', () => {
    test('should generate Numeric reference for numeric/decimal', () => {
      const numericResult = mapPostgresType('numeric', false);
      const decimalResult = mapPostgresType('decimal', false);

      expect(numericResult).toEqual({ kind: 'reference', name: 'Numeric' });
      expect(decimalResult).toEqual({ kind: 'reference', name: 'Numeric' });

      const serialized = serialize({
        declarations: [
          {
            kind: 'interface',
            name: 'TestInterface',
            properties: [
              { name: 'num', type: numericResult, optional: false },
              { name: 'dec', type: decimalResult, optional: false },
            ],
            exported: true,
          },
        ],
      });

      expect(serialized).toContain('num: Numeric');
      expect(serialized).toContain('dec: Numeric');
    });
  });

  describe('Generated type', () => {
    test('should properly define Generated conditional type', () => {
      const serialized = serialize({
        declarations: [
          {
            kind: 'typeAlias',
            name: 'Generated<T>',
            type: {
              kind: 'raw',
              value: `T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>`,
            },
            exported: true,
          },
        ],
      });

      expect(serialized).toContain('export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>');
      expect(serialized).toContain('? ColumnType<S, I | undefined, U>');
      expect(serialized).toContain(': ColumnType<T, T | undefined, T>');
    });
  });

  describe('Simple types (without ColumnType)', () => {
    test('should not wrap simple types in ColumnType', () => {
      const intResult = mapPostgresType('int4', false);
      const stringResult = mapPostgresType('varchar', false);
      const boolResult = mapPostgresType('bool', false);

      const serialized = serialize({
        declarations: [
          {
            kind: 'interface',
            name: 'TestInterface',
            properties: [
              { name: 'id', type: intResult, optional: false },
              { name: 'name', type: stringResult, optional: false },
              { name: 'active', type: boolResult, optional: false },
            ],
            exported: true,
          },
        ],
      });

      // These should be simple types, not wrapped in ColumnType
      expect(serialized).toContain('id: number;');
      expect(serialized).toContain('name: string;');
      expect(serialized).toContain('active: boolean;');
      expect(serialized).not.toContain('ColumnType<number');
      expect(serialized).not.toContain('ColumnType<string');
      expect(serialized).not.toContain('ColumnType<boolean');
    });
  });
});
