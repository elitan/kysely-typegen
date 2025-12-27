import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Kysely, SqliteDialect } from 'kysely';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'fs';
import { introspectSqlite } from '@/dialects/sqlite/introspect';
import { createBunSqliteDatabase } from '../utils/bun-sqlite';

describe('SQLite Introspector', () => {
  let db: Kysely<any>;
  let sqliteDb: Database;

  beforeAll(async () => {
    sqliteDb = new Database(':memory:');
    db = new Kysely({
      dialect: new SqliteDialect({ database: createBunSqliteDatabase(sqliteDb) }),
    });

    const initSql = readFileSync('test/fixtures/sqlite-init.sql', 'utf8');
    sqliteDb.exec(initSql);
  });

  afterAll(async () => {
    await db.destroy();
  });

  test('should introspect tables from database', async () => {
    const metadata = await introspectSqlite(db, { schemas: ['main'] });

    expect(metadata.tables.length).toBeGreaterThan(0);

    const users = metadata.tables.find((t) => t.name === 'users');
    expect(users).toBeDefined();
    expect(users?.schema).toBe('main');
  });

  test('should introspect columns with correct types', async () => {
    const metadata = await introspectSqlite(db, { schemas: ['main'] });

    const users = metadata.tables.find((t) => t.name === 'users');
    expect(users).toBeDefined();

    const idColumn = users?.columns.find((c) => c.name === 'id');
    expect(idColumn).toBeDefined();
    expect(idColumn?.dataType).toBe('integer');
    expect(idColumn?.isNullable).toBe(false);
    expect(idColumn?.isAutoIncrement).toBe(true);

    const emailColumn = users?.columns.find((c) => c.name === 'email');
    expect(emailColumn).toBeDefined();
    expect(emailColumn?.dataType).toBe('text');
    expect(emailColumn?.isNullable).toBe(false);
  });

  test('should detect INTEGER PRIMARY KEY as auto-increment', async () => {
    const metadata = await introspectSqlite(db, { schemas: ['main'] });

    const users = metadata.tables.find((t) => t.name === 'users');
    const idColumn = users?.columns.find((c) => c.name === 'id');

    expect(idColumn?.isAutoIncrement).toBe(true);
    expect(idColumn?.hasDefaultValue).toBe(true);
  });

  test('should identify nullable columns', async () => {
    const metadata = await introspectSqlite(db, { schemas: ['main'] });

    const users = metadata.tables.find((t) => t.name === 'users');
    const updatedAtColumn = users?.columns.find((c) => c.name === 'updated_at');

    expect(updatedAtColumn).toBeDefined();
    expect(updatedAtColumn?.isNullable).toBe(true);
  });

  test('should have empty enums (SQLite has no native enum)', async () => {
    const metadata = await introspectSqlite(db, { schemas: ['main'] });
    expect(metadata.enums).toEqual([]);
  });

  test('should introspect BLOB columns', async () => {
    const metadata = await introspectSqlite(db, { schemas: ['main'] });

    const files = metadata.tables.find((t) => t.name === 'files');
    expect(files).toBeDefined();

    const contentColumn = files?.columns.find((c) => c.name === 'content');
    expect(contentColumn?.dataType).toBe('blob');
    expect(contentColumn?.isNullable).toBe(true);

    const checksumColumn = files?.columns.find((c) => c.name === 'checksum');
    expect(checksumColumn?.dataType).toBe('blob');
  });

  test('should introspect REAL columns', async () => {
    const metadata = await introspectSqlite(db, { schemas: ['main'] });

    const users = metadata.tables.find((t) => t.name === 'users');
    const balanceColumn = users?.columns.find((c) => c.name === 'balance');

    expect(balanceColumn).toBeDefined();
    expect(balanceColumn?.dataType).toBe('real');
  });

  test('should introspect views', async () => {
    const metadata = await introspectSqlite(db, { schemas: ['main'] });

    const activeUsers = metadata.tables.find((t) => t.name === 'active_users');
    expect(activeUsers).toBeDefined();
    expect(activeUsers?.isView).toBe(true);
    expect(activeUsers?.schema).toBe('main');

    const columns = activeUsers?.columns ?? [];
    expect(columns.length).toBe(4);

    const idColumn = columns.find((c) => c.name === 'id');
    expect(idColumn).toBeDefined();
  });

  test('should introspect columns with default values', async () => {
    const metadata = await introspectSqlite(db, { schemas: ['main'] });

    const users = metadata.tables.find((t) => t.name === 'users');
    const isActiveColumn = users?.columns.find((c) => c.name === 'is_active');

    expect(isActiveColumn).toBeDefined();
    expect(isActiveColumn?.hasDefaultValue).toBe(true);
  });

  test('should introspect various numeric types', async () => {
    const metadata = await introspectSqlite(db, { schemas: ['main'] });

    const metrics = metadata.tables.find((t) => t.name === 'metrics');
    expect(metrics).toBeDefined();

    const intColumn = metrics?.columns.find((c) => c.name === 'int_val');
    expect(intColumn?.dataType).toBe('integer');

    const realColumn = metrics?.columns.find((c) => c.name === 'real_val');
    expect(realColumn?.dataType).toBe('real');

    const numericColumn = metrics?.columns.find((c) => c.name === 'numeric_val');
    expect(numericColumn?.dataType).toBe('numeric');
  });

  test('should introspect all test tables', async () => {
    const metadata = await introspectSqlite(db, { schemas: ['main'] });

    const tableNames = metadata.tables
      .filter((t) => !t.isView)
      .map((t) => t.name)
      .sort();

    expect(tableNames).toContain('users');
    expect(tableNames).toContain('posts');
    expect(tableNames).toContain('comments');
    expect(tableNames).toContain('files');
    expect(tableNames).toContain('metrics');
  });

  test('should introspect JSON columns', async () => {
    const metadata = await introspectSqlite(db, { schemas: ['main'] });

    const users = metadata.tables.find((t) => t.name === 'users');
    const metadataColumn = users?.columns.find((c) => c.name === 'metadata');

    expect(metadataColumn).toBeDefined();
    expect(metadataColumn?.dataType).toBe('json');
    expect(metadataColumn?.isNullable).toBe(true);
  });

  test('should introspect view with join', async () => {
    const metadata = await introspectSqlite(db, { schemas: ['main'] });

    const userPosts = metadata.tables.find((t) => t.name === 'user_posts');
    expect(userPosts).toBeDefined();
    expect(userPosts?.isView).toBe(true);

    const columns = userPosts?.columns ?? [];
    expect(columns.length).toBe(4);

    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain('user_id');
    expect(columnNames).toContain('username');
    expect(columnNames).toContain('post_id');
    expect(columnNames).toContain('title');
  });

  test('should detect NOT NULL constraints', async () => {
    const metadata = await introspectSqlite(db, { schemas: ['main'] });

    const posts = metadata.tables.find((t) => t.name === 'posts');
    expect(posts).toBeDefined();

    const titleColumn = posts?.columns.find((c) => c.name === 'title');
    expect(titleColumn?.isNullable).toBe(false);

    const contentColumn = posts?.columns.find((c) => c.name === 'content');
    expect(contentColumn?.isNullable).toBe(true);
  });

  test('should not mark view columns as auto-increment', async () => {
    const metadata = await introspectSqlite(db, { schemas: ['main'] });

    const activeUsers = metadata.tables.find((t) => t.name === 'active_users');
    const idColumn = activeUsers?.columns.find((c) => c.name === 'id');

    expect(idColumn).toBeDefined();
    expect(idColumn?.isAutoIncrement).toBe(false);
  });

  test('should introspect foreign key columns', async () => {
    const metadata = await introspectSqlite(db, { schemas: ['main'] });

    const posts = metadata.tables.find((t) => t.name === 'posts');
    const userIdColumn = posts?.columns.find((c) => c.name === 'user_id');

    expect(userIdColumn).toBeDefined();
    expect(userIdColumn?.dataType).toBe('integer');
    expect(userIdColumn?.isNullable).toBe(false);
    expect(userIdColumn?.isAutoIncrement).toBe(false);
  });
});
