import { describe, expect, test } from 'bun:test';
import { filterTables } from '@/transform/filter';
import type { TableMetadata } from '@/introspect/types';

function createTable(name: string, opts?: { isPartition?: boolean; schema?: string }): TableMetadata {
  return {
    name,
    schema: opts?.schema ?? 'public',
    columns: [],
    isPartition: opts?.isPartition,
  };
}

describe('filterTables', () => {
  test('should filter out partition tables', () => {
    const tables = [
      createTable('measurements'),
      createTable('measurements_2024_q1', { isPartition: true }),
      createTable('measurements_2024_q2', { isPartition: true }),
      createTable('users'),
    ];

    const result = filterTables(tables);

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.name)).toEqual(['measurements', 'users']);
  });

  test('should keep all tables when none are partitions', () => {
    const tables = [createTable('users'), createTable('posts'), createTable('comments')];

    const result = filterTables(tables);

    expect(result).toHaveLength(3);
  });

  test('should apply pattern filtering after partition filtering', () => {
    const tables = [
      createTable('measurements'),
      createTable('measurements_2024_q1', { isPartition: true }),
      createTable('users'),
      createTable('logs'),
    ];

    const result = filterTables(tables, { excludePattern: ['*.logs'] });

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.name)).toEqual(['measurements', 'users']);
  });

  test('should apply include pattern after partition filtering', () => {
    const tables = [
      createTable('measurements'),
      createTable('measurements_2024_q1', { isPartition: true }),
      createTable('users'),
    ];

    const result = filterTables(tables, { includePattern: ['*.users'] });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('users');
  });
});
