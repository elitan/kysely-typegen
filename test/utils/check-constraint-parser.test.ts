import { describe, expect, test } from 'bun:test';
import { parseCheckConstraint } from '@/utils/check-constraint-parser';

describe('parseCheckConstraint', () => {
  describe('ANY ARRAY string patterns', () => {
    test('parses simple IN() pattern normalized to ANY ARRAY', () => {
      const result = parseCheckConstraint(
        "CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text])))"
      );
      expect(result).toEqual({
        type: 'string',
        values: ['pending', 'active', 'completed'],
      });
    });

    test('parses two values', () => {
      const result = parseCheckConstraint(
        "CHECK ((type = ANY (ARRAY['proxy'::text, 'redirect'::text])))"
      );
      expect(result).toEqual({
        type: 'string',
        values: ['proxy', 'redirect'],
      });
    });

    test('parses single value', () => {
      const result = parseCheckConstraint(
        "CHECK ((val = ANY (ARRAY['only'::text])))"
      );
      expect(result).toEqual({
        type: 'string',
        values: ['only'],
      });
    });

    test('handles values with spaces', () => {
      const result = parseCheckConstraint(
        "CHECK ((status = ANY (ARRAY['in progress'::text, 'on hold'::text])))"
      );
      expect(result).toEqual({
        type: 'string',
        values: ['in progress', 'on hold'],
      });
    });

    test('handles escaped single quotes', () => {
      const result = parseCheckConstraint(
        "CHECK ((val = ANY (ARRAY['it''s'::text, 'won''t'::text])))"
      );
      expect(result).toEqual({
        type: 'string',
        values: ["it's", "won't"],
      });
    });

    test('handles different type casts', () => {
      const result = parseCheckConstraint(
        "CHECK ((val = ANY (ARRAY['a'::character varying, 'b'::character varying])))"
      );
      expect(result).toEqual({
        type: 'string',
        values: ['a', 'b'],
      });
    });
  });

  describe('ANY ARRAY numeric patterns', () => {
    test('parses integer array', () => {
      const result = parseCheckConstraint(
        'CHECK ((priority = ANY (ARRAY[1, 2, 3, 4, 5])))'
      );
      expect(result).toEqual({
        type: 'number',
        values: [1, 2, 3, 4, 5],
      });
    });

    test('parses single integer', () => {
      const result = parseCheckConstraint(
        'CHECK ((val = ANY (ARRAY[42])))'
      );
      expect(result).toEqual({
        type: 'number',
        values: [42],
      });
    });

    test('parses negative integers', () => {
      const result = parseCheckConstraint(
        'CHECK ((val = ANY (ARRAY[-1, 0, 1])))'
      );
      expect(result).toEqual({
        type: 'number',
        values: [-1, 0, 1],
      });
    });
  });

  describe('OR chain patterns', () => {
    test('parses OR chain with three values', () => {
      const result = parseCheckConstraint(
        "CHECK (((level = 'low'::text) OR (level = 'medium'::text) OR (level = 'high'::text)))"
      );
      expect(result).toEqual({
        type: 'string',
        values: ['low', 'medium', 'high'],
      });
    });

    test('parses OR chain with two values', () => {
      const result = parseCheckConstraint(
        "CHECK (((status = 'yes'::text) OR (status = 'no'::text)))"
      );
      expect(result).toEqual({
        type: 'string',
        values: ['yes', 'no'],
      });
    });
  });

  describe('non-enum patterns (should return null)', () => {
    test('returns null for range check (>=)', () => {
      const result = parseCheckConstraint('CHECK ((range_col >= 0))');
      expect(result).toBeNull();
    });

    test('returns null for range check (BETWEEN)', () => {
      const result = parseCheckConstraint(
        'CHECK ((val >= 1) AND (val <= 100))'
      );
      expect(result).toBeNull();
    });

    test('returns null for regex check', () => {
      const result = parseCheckConstraint(
        "CHECK ((regex_col ~* '^[a-z]+$'::text))"
      );
      expect(result).toBeNull();
    });

    test('returns null for LIKE check', () => {
      const result = parseCheckConstraint(
        "CHECK ((col ~~ '%pattern%'::text))"
      );
      expect(result).toBeNull();
    });

    test('returns null for multi-column check', () => {
      const result = parseCheckConstraint(
        'CHECK ((start_time < end_time))'
      );
      expect(result).toBeNull();
    });

    test('returns null for empty array', () => {
      const result = parseCheckConstraint('CHECK ((val = ANY (ARRAY[])))');
      expect(result).toBeNull();
    });

    test('returns null for length check', () => {
      const result = parseCheckConstraint(
        'CHECK ((length((name)::text) < 100))'
      );
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    test('handles domain CHECK constraint format (VALUE instead of column name)', () => {
      const result = parseCheckConstraint(
        "CHECK (((VALUE)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'archived'::character varying])::text[])))"
      );
      expect(result).toEqual({
        type: 'string',
        values: ['draft', 'published', 'archived'],
      });
    });

    test('handles yes_or_no domain format', () => {
      const result = parseCheckConstraint(
        "CHECK (((VALUE)::text = ANY ((ARRAY['YES'::character varying, 'NO'::character varying])::text[])))"
      );
      expect(result).toEqual({
        type: 'string',
        values: ['YES', 'NO'],
      });
    });

    test('handles simpler domain CHECK constraint (VALUE without cast)', () => {
      const result = parseCheckConstraint(
        "CHECK ((VALUE = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))"
      );
      expect(result).toEqual({
        type: 'string',
        values: ['draft', 'published', 'archived'],
      });
    });
  });
});
