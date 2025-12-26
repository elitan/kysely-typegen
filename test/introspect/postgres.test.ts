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

  test('should introspect array columns', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public'] });

    const users = metadata.tables.find((t) => t.name === 'users');
    expect(users).toBeDefined();

    const tagsColumn = users?.columns.find((c) => c.name === 'tags');
    expect(tagsColumn).toBeDefined();
    expect(tagsColumn?.dataType).toBe('text');
    expect(tagsColumn?.isArray).toBe(true);

    const scoresColumn = users?.columns.find((c) => c.name === 'scores');
    expect(scoresColumn).toBeDefined();
    expect(scoresColumn?.dataType).toBe('int4');
    expect(scoresColumn?.isArray).toBe(true);
    expect(scoresColumn?.isNullable).toBe(true);
  });

  test('should introspect column comments', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public'] });

    const users = metadata.tables.find((t) => t.name === 'users');
    const emailColumn = users?.columns.find((c) => c.name === 'email');

    expect(emailColumn?.comment).toBe('User email address');

    const tagsColumn = users?.columns.find((c) => c.name === 'tags');
    expect(tagsColumn?.comment).toBe('Array of user tags');
  });

  test('should introspect materialized views', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public'] });

    const userStats = metadata.tables.find((t) => t.name === 'user_stats');
    expect(userStats).toBeDefined();
    expect(userStats?.isView).toBe(true);
    expect(userStats?.columns.length).toBeGreaterThan(0);

    const idColumn = userStats?.columns.find((c) => c.name === 'id');
    expect(idColumn).toBeDefined();
    expect(idColumn?.isAutoIncrement).toBe(false);
  });

  test('should introspect domain types as their base types', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public'] });

    const posts = metadata.tables.find((t) => t.name === 'posts');
    const viewCountColumn = posts?.columns.find((c) => c.name === 'view_count');

    expect(viewCountColumn).toBeDefined();
    expect(viewCountColumn?.dataType).toBe('int4');
    expect(viewCountColumn?.isNullable).toBe(false);
  });

  test('should introspect multiple schemas', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public', 'test_schema'] });

    const tableSchemas = metadata.tables.map((t) => t.schema);
    expect(tableSchemas).toContain('public');
    expect(tableSchemas).toContain('test_schema');

    const tasksTable = metadata.tables.find(
      (t) => t.schema === 'test_schema' && t.name === 'tasks'
    );
    expect(tasksTable).toBeDefined();
    expect(tasksTable?.columns.length).toBeGreaterThan(0);
  });

  test('should introspect enums from different schemas', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public', 'test_schema'] });

    const enumSchemas = metadata.enums.map((e) => e.schema);
    expect(enumSchemas).toContain('public');
    expect(enumSchemas).toContain('test_schema');

    const statusEnum = metadata.enums.find(
      (e) => e.schema === 'public' && e.name === 'status_enum'
    );
    expect(statusEnum?.values).toEqual(['pending', 'approved', 'rejected']);

    const priorityEnum = metadata.enums.find(
      (e) => e.schema === 'test_schema' && e.name === 'priority_enum'
    );
    expect(priorityEnum?.values).toEqual(['low', 'medium', 'high']);
  });

  test('should handle domain types in columns (resolved to base types)', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['test_schema'] });

    const tasks = metadata.tables.find((t) => t.name === 'tasks');
    const emailColumn = tasks?.columns.find((c) => c.name === 'assignee_email');

    expect(emailColumn).toBeDefined();
    expect(emailColumn?.dataType).toBe('varchar');
  });

  test('should detect partitioned tables', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public'] });

    const parentTable = metadata.tables.find((t) => t.name === 'measurements');
    expect(parentTable).toBeDefined();
    expect(parentTable?.isPartition).toBeUndefined();

    const partition1 = metadata.tables.find((t) => t.name === 'measurements_2024_q1');
    expect(partition1).toBeDefined();
    expect(partition1?.isPartition).toBe(true);

    const partition2 = metadata.tables.find((t) => t.name === 'measurements_2024_q2');
    expect(partition2).toBeDefined();
    expect(partition2?.isPartition).toBe(true);
  });

  test('should detect array columns in materialized views', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public'] });

    const userTagsView = metadata.tables.find((t) => t.name === 'user_tags_view');
    expect(userTagsView).toBeDefined();
    expect(userTagsView?.isView).toBe(true);

    const tagsColumn = userTagsView?.columns.find((c) => c.name === 'tags');
    expect(tagsColumn).toBeDefined();
    expect(tagsColumn?.isArray).toBe(true);
    expect(tagsColumn?.dataType).toBe('text');
  });

  test('should introspect regular views', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public'] });

    const activeUsers = metadata.tables.find((t) => t.name === 'active_users');
    expect(activeUsers).toBeDefined();
    expect(activeUsers?.isView).toBe(true);
    expect(activeUsers?.schema).toBe('public');

    const columns = activeUsers?.columns ?? [];
    expect(columns.length).toBe(4);

    const idColumn = columns.find((c) => c.name === 'id');
    expect(idColumn).toBeDefined();
    expect(idColumn?.dataType).toBe('int4');

    const emailColumn = columns.find((c) => c.name === 'email');
    expect(emailColumn).toBeDefined();
    expect(emailColumn?.dataType).toBe('varchar');
  });
});
