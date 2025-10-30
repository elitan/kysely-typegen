import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { introspectDatabase } from '@/introspect/postgres';

const TEST_DATABASE_URL = 'postgres://test_user:test_password@localhost:5433/test_db';

describe('PostgreSQL Introspector', () => {
  let db: Kysely<any>;

  beforeAll(async () => {
    const pool = new Pool({ connectionString: TEST_DATABASE_URL });
    db = new Kysely({
      dialect: new PostgresDialect({ pool }),
    });
  });

  afterAll(async () => {
    await db.destroy();
  });

  test('should introspect tables from database', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public'] });

    expect(metadata.tables.length).toBeGreaterThan(0);

    const users = metadata.tables.find((t) => t.name === 'users');
    expect(users).toBeDefined();
    expect(users?.schema).toBe('public');
  });

  test('should introspect columns with correct types', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public'] });

    const users = metadata.tables.find((t) => t.name === 'users');
    expect(users).toBeDefined();

    const idColumn = users?.columns.find((c) => c.name === 'id');
    expect(idColumn).toBeDefined();
    expect(idColumn?.dataType).toBe('int4');
    expect(idColumn?.isNullable).toBe(false);
    expect(idColumn?.isAutoIncrement).toBe(true);

    const emailColumn = users?.columns.find((c) => c.name === 'email');
    expect(emailColumn).toBeDefined();
    expect(emailColumn?.dataType).toBe('varchar');
    expect(emailColumn?.isNullable).toBe(false);
  });

  test('should identify nullable columns', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public'] });

    const users = metadata.tables.find((t) => t.name === 'users');
    const updatedAtColumn = users?.columns.find((c) => c.name === 'updated_at');

    expect(updatedAtColumn).toBeDefined();
    expect(updatedAtColumn?.isNullable).toBe(true);
  });

  test('should identify columns with default values', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public'] });

    const users = metadata.tables.find((t) => t.name === 'users');
    const createdAtColumn = users?.columns.find((c) => c.name === 'created_at');
    const isActiveColumn = users?.columns.find((c) => c.name === 'is_active');

    expect(createdAtColumn?.hasDefaultValue).toBe(true);
    expect(isActiveColumn?.hasDefaultValue).toBe(true);
  });

  test('should introspect all test tables', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public'] });

    const tableNames = metadata.tables.map((t) => t.name).sort();
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('posts');
    expect(tableNames).toContain('comments');
  });

  test('should introspect enum types', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public'] });

    const statusEnum = metadata.enums.find((e) => e.name === 'status_enum');
    expect(statusEnum).toBeDefined();
    expect(statusEnum?.values).toEqual(['pending', 'approved', 'rejected']);
  });
});
