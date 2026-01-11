import { describe, expect, test } from 'bun:test';
import {
  parseCheckConstraint,
  parseMssqlCheckConstraint,
  parseMysqlCheckConstraint,
  parseSqliteCheckConstraint,
} from '@/utils/check-constraint-parser';

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

describe('parseSqliteCheckConstraint', () => {
  describe('string patterns', () => {
    test('parses string IN list', () => {
      const result = parseSqliteCheckConstraint("status IN ('draft', 'published', 'archived')");
      expect(result).toEqual({
        type: 'string',
        values: ['draft', 'published', 'archived'],
      });
    });

    test('parses two values', () => {
      const result = parseSqliteCheckConstraint("type IN ('proxy', 'redirect')");
      expect(result).toEqual({
        type: 'string',
        values: ['proxy', 'redirect'],
      });
    });

    test('handles escaped quotes', () => {
      const result = parseSqliteCheckConstraint("val IN ('it''s', 'won''t')");
      expect(result).toEqual({
        type: 'string',
        values: ["it's", "won't"],
      });
    });
  });

  describe('numeric patterns', () => {
    test('parses integer IN list', () => {
      const result = parseSqliteCheckConstraint('level IN (1, 2, 3, 4, 5)');
      expect(result).toEqual({
        type: 'number',
        values: [1, 2, 3, 4, 5],
      });
    });

    test('parses negative integers', () => {
      const result = parseSqliteCheckConstraint('val IN (-1, 0, 1)');
      expect(result).toEqual({
        type: 'number',
        values: [-1, 0, 1],
      });
    });
  });

  describe('boolean detection', () => {
    test('detects boolean pattern (0, 1)', () => {
      const result = parseSqliteCheckConstraint('is_enabled IN (0, 1)');
      expect(result).toEqual({ type: 'boolean' });
    });

    test('detects boolean pattern (1, 0) - reversed order', () => {
      const result = parseSqliteCheckConstraint('is_active IN (1, 0)');
      expect(result).toEqual({ type: 'boolean' });
    });

    test('does NOT detect boolean for (0, 1, 2)', () => {
      const result = parseSqliteCheckConstraint('level IN (0, 1, 2)');
      expect(result).toEqual({
        type: 'number',
        values: [0, 1, 2],
      });
    });

    test('does NOT detect boolean for (0, 2)', () => {
      const result = parseSqliteCheckConstraint('flag IN (0, 2)');
      expect(result).toEqual({
        type: 'number',
        values: [0, 2],
      });
    });

    test('does NOT detect boolean for single value (0)', () => {
      const result = parseSqliteCheckConstraint('flag IN (0)');
      expect(result).toEqual({
        type: 'number',
        values: [0],
      });
    });
  });

  describe('non-enum patterns', () => {
    test('returns null for non-IN pattern', () => {
      const result = parseSqliteCheckConstraint('value >= 0');
      expect(result).toBeNull();
    });

    test('returns null for empty input', () => {
      const result = parseSqliteCheckConstraint('');
      expect(result).toBeNull();
    });
  });
});

describe('parseMssqlCheckConstraint', () => {
  describe('IN string patterns', () => {
    test('parses IN with string values', () => {
      const result = parseMssqlCheckConstraint(
        "([status] IN ('draft', 'published', 'archived'))"
      );
      expect(result).toEqual({
        type: 'string',
        values: ['draft', 'published', 'archived'],
      });
    });

    test('parses IN with two values', () => {
      const result = parseMssqlCheckConstraint(
        "([type] IN ('proxy', 'redirect'))"
      );
      expect(result).toEqual({
        type: 'string',
        values: ['proxy', 'redirect'],
      });
    });

    test('handles escaped quotes', () => {
      const result = parseMssqlCheckConstraint(
        "([val] IN ('it''s', 'won''t'))"
      );
      expect(result).toEqual({
        type: 'string',
        values: ["it's", "won't"],
      });
    });

    test('handles values with spaces', () => {
      const result = parseMssqlCheckConstraint(
        "([status] IN ('in progress', 'on hold'))"
      );
      expect(result).toEqual({
        type: 'string',
        values: ['in progress', 'on hold'],
      });
    });
  });

  describe('IN numeric patterns', () => {
    test('parses IN with integer values', () => {
      const result = parseMssqlCheckConstraint('([level] IN (1, 2, 3, 4, 5))');
      expect(result).toEqual({
        type: 'number',
        values: [1, 2, 3, 4, 5],
      });
    });

    test('parses negative integers', () => {
      const result = parseMssqlCheckConstraint('([val] IN (-1, 0, 1))');
      expect(result).toEqual({
        type: 'number',
        values: [-1, 0, 1],
      });
    });
  });

  describe('boolean detection', () => {
    test('detects boolean pattern (0, 1)', () => {
      const result = parseMssqlCheckConstraint('([is_enabled] IN (0, 1))');
      expect(result).toEqual({ type: 'boolean' });
    });

    test('detects boolean pattern (1, 0) - reversed order', () => {
      const result = parseMssqlCheckConstraint('([is_active] IN (1, 0))');
      expect(result).toEqual({ type: 'boolean' });
    });

    test('does NOT detect boolean for (0, 1, 2)', () => {
      const result = parseMssqlCheckConstraint('([level] IN (0, 1, 2))');
      expect(result).toEqual({
        type: 'number',
        values: [0, 1, 2],
      });
    });
  });

  describe('OR chain patterns', () => {
    test('parses OR chain with string values', () => {
      const result = parseMssqlCheckConstraint(
        "([priority]='low' OR [priority]='medium' OR [priority]='high')"
      );
      expect(result).toEqual({
        type: 'string',
        values: ['low', 'medium', 'high'],
      });
    });

    test('parses OR chain with two values', () => {
      const result = parseMssqlCheckConstraint(
        "([status]='yes' OR [status]='no')"
      );
      expect(result).toEqual({
        type: 'string',
        values: ['yes', 'no'],
      });
    });

    test('handles escaped quotes in OR chain', () => {
      const result = parseMssqlCheckConstraint(
        "([val]='it''s' OR [val]='won''t')"
      );
      expect(result).toEqual({
        type: 'string',
        values: ["it's", "won't"],
      });
    });
  });

  describe('non-enum patterns', () => {
    test('returns null for range check', () => {
      const result = parseMssqlCheckConstraint('([value]>=(0))');
      expect(result).toBeNull();
    });

    test('returns null for LIKE check', () => {
      const result = parseMssqlCheckConstraint("([col] LIKE '%pattern%')");
      expect(result).toBeNull();
    });

    test('returns null for empty input', () => {
      const result = parseMssqlCheckConstraint('');
      expect(result).toBeNull();
    });

    test('returns null for multi-column check', () => {
      const result = parseMssqlCheckConstraint('([start_time]<[end_time])');
      expect(result).toBeNull();
    });
  });
});

describe('parseMysqlCheckConstraint', () => {
  describe('IN string patterns', () => {
    test('parses IN with string values (backtick-quoted column)', () => {
      const result = parseMysqlCheckConstraint(
        "`status` IN ('draft', 'published', 'archived')"
      );
      expect(result).toEqual({
        columnName: 'status',
        constraint: { type: 'string', values: ['draft', 'published', 'archived'] },
      });
    });

    test('parses IN with string values (unquoted column)', () => {
      const result = parseMysqlCheckConstraint(
        "status IN ('draft', 'published', 'archived')"
      );
      expect(result).toEqual({
        columnName: 'status',
        constraint: { type: 'string', values: ['draft', 'published', 'archived'] },
      });
    });

    test('parses MySQL charset-prefixed format from CHECK_CLAUSE', () => {
      const result = parseMysqlCheckConstraint(
        "(`status` in (_latin1\\'active\\',_latin1\\'inactive\\',_latin1\\'pending\\'))"
      );
      expect(result).toEqual({
        columnName: 'status',
        constraint: { type: 'string', values: ['active', 'inactive', 'pending'] },
      });
    });

    test('parses IN with two values', () => {
      const result = parseMysqlCheckConstraint(
        "`type` in ('proxy', 'redirect')"
      );
      expect(result).toEqual({
        columnName: 'type',
        constraint: { type: 'string', values: ['proxy', 'redirect'] },
      });
    });

    test('handles escaped quotes', () => {
      const result = parseMysqlCheckConstraint(
        "`val` IN ('it''s', 'won''t')"
      );
      expect(result).toEqual({
        columnName: 'val',
        constraint: { type: 'string', values: ["it's", "won't"] },
      });
    });

    test('handles values with spaces', () => {
      const result = parseMysqlCheckConstraint(
        "`status` IN ('in progress', 'on hold')"
      );
      expect(result).toEqual({
        columnName: 'status',
        constraint: { type: 'string', values: ['in progress', 'on hold'] },
      });
    });

    test('handles wrapped in parentheses', () => {
      const result = parseMysqlCheckConstraint(
        "(`status` in ('active', 'inactive'))"
      );
      expect(result).toEqual({
        columnName: 'status',
        constraint: { type: 'string', values: ['active', 'inactive'] },
      });
    });
  });

  describe('IN numeric patterns', () => {
    test('parses IN with integer values', () => {
      const result = parseMysqlCheckConstraint('`level` IN (1, 2, 3, 4, 5)');
      expect(result).toEqual({
        columnName: 'level',
        constraint: { type: 'number', values: [1, 2, 3, 4, 5] },
      });
    });

    test('parses negative integers', () => {
      const result = parseMysqlCheckConstraint('val IN (-1, 0, 1)');
      expect(result).toEqual({
        columnName: 'val',
        constraint: { type: 'number', values: [-1, 0, 1] },
      });
    });
  });

  describe('boolean detection', () => {
    test('detects boolean pattern (0, 1)', () => {
      const result = parseMysqlCheckConstraint('`is_enabled` IN (0, 1)');
      expect(result).toEqual({
        columnName: 'is_enabled',
        constraint: { type: 'boolean' },
      });
    });

    test('detects boolean pattern (1, 0) - reversed order', () => {
      const result = parseMysqlCheckConstraint('is_active IN (1, 0)');
      expect(result).toEqual({
        columnName: 'is_active',
        constraint: { type: 'boolean' },
      });
    });

    test('does NOT detect boolean for (0, 1, 2)', () => {
      const result = parseMysqlCheckConstraint('`level` IN (0, 1, 2)');
      expect(result).toEqual({
        columnName: 'level',
        constraint: { type: 'number', values: [0, 1, 2] },
      });
    });
  });

  describe('non-enum patterns', () => {
    test('returns null for range check', () => {
      const result = parseMysqlCheckConstraint('`value` >= 0');
      expect(result).toBeNull();
    });

    test('returns null for LIKE check', () => {
      const result = parseMysqlCheckConstraint("`col` LIKE '%pattern%'");
      expect(result).toBeNull();
    });

    test('returns null for empty input', () => {
      const result = parseMysqlCheckConstraint('');
      expect(result).toBeNull();
    });

    test('returns null for multi-column check', () => {
      const result = parseMysqlCheckConstraint('`start_time` < `end_time`');
      expect(result).toBeNull();
    });
  });
});
