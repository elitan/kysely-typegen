import { describe, expect, test } from 'bun:test';
import { parseSqliteTableDDL } from '@/utils/sqlite-ddl-parser';

describe('parseSqliteTableDDL', () => {
  test('parses inline CHECK with string IN list', () => {
    const ddl = `CREATE TABLE posts (
      id INTEGER PRIMARY KEY,
      status TEXT NOT NULL CHECK(status IN ('draft', 'published', 'archived'))
    )`;
    const result = parseSqliteTableDDL(ddl);
    expect(result).toEqual([
      { columnName: 'status', definition: "status IN ('draft', 'published', 'archived')" },
    ]);
  });

  test('parses inline CHECK with numeric IN list', () => {
    const ddl = `CREATE TABLE priorities (
      id INTEGER PRIMARY KEY,
      level INTEGER NOT NULL CHECK(level IN (1, 2, 3, 4, 5))
    )`;
    const result = parseSqliteTableDDL(ddl);
    expect(result).toEqual([
      { columnName: 'level', definition: 'level IN (1, 2, 3, 4, 5)' },
    ]);
  });

  test('parses boolean pattern CHECK(col IN (0, 1))', () => {
    const ddl = `CREATE TABLE settings (
      id INTEGER PRIMARY KEY,
      is_enabled INTEGER NOT NULL CHECK(is_enabled IN (0, 1))
    )`;
    const result = parseSqliteTableDDL(ddl);
    expect(result).toEqual([
      { columnName: 'is_enabled', definition: 'is_enabled IN (0, 1)' },
    ]);
  });

  test('parses multiple CHECK constraints in one table', () => {
    const ddl = `CREATE TABLE posts (
      id INTEGER PRIMARY KEY,
      status TEXT NOT NULL CHECK(status IN ('draft', 'published')),
      is_featured INTEGER CHECK(is_featured IN (0, 1))
    )`;
    const result = parseSqliteTableDDL(ddl);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      columnName: 'status',
      definition: "status IN ('draft', 'published')",
    });
    expect(result).toContainEqual({
      columnName: 'is_featured',
      definition: 'is_featured IN (0, 1)',
    });
  });

  test('handles CHECK with spaces around parentheses', () => {
    const ddl = `CREATE TABLE posts (
      status TEXT CHECK ( status IN ( 'a' , 'b' ) )
    )`;
    const result = parseSqliteTableDDL(ddl);
    expect(result).toHaveLength(1);
    expect(result[0].columnName).toBe('status');
  });

  test('handles CHECK with lowercase keyword', () => {
    const ddl = `CREATE TABLE posts (
      status TEXT check(status in ('a', 'b'))
    )`;
    const result = parseSqliteTableDDL(ddl);
    expect(result).toHaveLength(1);
    expect(result[0].columnName).toBe('status');
  });

  test('returns empty array for table without CHECK constraints', () => {
    const ddl = `CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    )`;
    const result = parseSqliteTableDDL(ddl);
    expect(result).toEqual([]);
  });

  test('ignores non-IN CHECK constraints (range checks)', () => {
    const ddl = `CREATE TABLE metrics (
      id INTEGER PRIMARY KEY,
      value INTEGER CHECK(value >= 0 AND value <= 100)
    )`;
    const result = parseSqliteTableDDL(ddl);
    expect(result).toEqual([]);
  });

  test('handles escaped quotes in string values', () => {
    const ddl = `CREATE TABLE items (
      status TEXT CHECK(status IN ('it''s ok', 'normal'))
    )`;
    const result = parseSqliteTableDDL(ddl);
    expect(result).toHaveLength(1);
    expect(result[0].columnName).toBe('status');
  });

  test('handles table-level CHECK constraint', () => {
    const ddl = `CREATE TABLE posts (
      id INTEGER PRIMARY KEY,
      status TEXT,
      CHECK(status IN ('draft', 'published'))
    )`;
    const result = parseSqliteTableDDL(ddl);
    expect(result).toEqual([
      { columnName: 'status', definition: "status IN ('draft', 'published')" },
    ]);
  });
});
