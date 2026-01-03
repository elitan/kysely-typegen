import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { serialize } from '@/ast/serialize';
import { introspectPostgres as introspectDatabase } from '@/dialects/postgres/introspect';
import { transformDatabase } from '@/transform';

const TEST_DATABASE_URL = 'postgres://test_user:test_password@localhost:5433/test_db';

describe('Integration: Full pipeline', () => {
  let db: Kysely<any>;

  beforeAll(async () => {
    const pool = new Pool({ connectionString: TEST_DATABASE_URL });
    db = new Kysely({ dialect: new PostgresDialect({ pool }) });
  });

  afterAll(async () => {
    await db.destroy();
  });

  test('should generate complete TypeScript types from database', async () => {
    // Introspect
    const metadata = await introspectDatabase(db, { schemas: ['public'] });

    // Transform
    const { program } = transformDatabase(metadata);

    // Serialize
    const output = serialize(program);

    // Basic sanity checks
    expect(output).toContain("import type { ColumnType } from 'kysely'");
    expect(output).toContain('export type Generated<T>');
    expect(output).toContain('export interface User {');
    expect(output).toContain('export interface Post {');
    expect(output).toContain('export interface Comment {');
    expect(output).toContain('export interface DB {');
    expect(output).toContain('export type StatusEnum');

    // Check Generated columns
    expect(output).toContain('id: Generated<number>');

    // Check helper type definitions
    expect(output).toContain('export type Timestamp = ColumnType<Date, Date | string, Date | string>');
    expect(output).toContain('export type Int8 = ColumnType<string, string | number | bigint, string | number | bigint>');
    expect(output).toContain('export type Numeric = ColumnType<string, number | string, number | string>');

    // Check columns use helper references
    expect(output).toContain('updated_at: Timestamp | null');
    expect(output).toContain('created_at: Generated<Timestamp>');
    expect(output).toContain('content: string | null');

    // Check non-nullable columns
    expect(output).toContain('email: string;');
    expect(output).toContain('is_active: Generated<boolean>');

    // Snapshot the entire output
    expect(output).toMatchSnapshot();
  });

  test('should handle empty schema gracefully', async () => {
    // Test with a non-existent schema
    const metadata = await introspectDatabase(db, { schemas: ['nonexistent'] });

    expect(metadata.tables).toHaveLength(0);
    expect(metadata.enums).toHaveLength(0);

    const { program } = transformDatabase(metadata);
    const output = serialize(program);

    // Should still have imports and DB interface
    expect(output).toContain("import type { ColumnType } from 'kysely'");
    expect(output).toContain('export type Generated<T>');
    expect(output).toContain('export interface DB {');
  });
});
