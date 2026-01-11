import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { serialize } from '@/ast/serialize';
import { introspectPostgres as introspectDatabase } from '@/dialects/postgres/introspect';
import { transformDatabase } from '@/transform';
import { transformDatabaseToZod } from '@/zod/transform';
import { serializeZod } from '@/zod/serialize';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

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

  test('should generate Zod schemas from database', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public'] });

    const zodProgram = transformDatabaseToZod(metadata);
    const output = serializeZod(zodProgram);

    expect(output).toContain("import { z } from 'zod';");

    expect(output).toContain('export const userSchema = z.object({');
    expect(output).toContain('export const newUserSchema = z.object({');
    expect(output).toContain('export const userUpdateSchema = z.object({');

    expect(output).toContain('export type User = z.infer<typeof userSchema>;');
    expect(output).toContain('export type NewUser = z.infer<typeof newUserSchema>;');
    expect(output).toContain('export type UserUpdate = z.infer<typeof userUpdateSchema>;');

    expect(output).toContain('export const statusEnumSchema = z.enum([');

    expect(output).toContain('id: z.number()');
    expect(output).toContain('email: z.string()');

    expect(output).toMatchSnapshot();
  });

  test('should generate Zod schemas with camelCase option', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public'] });

    const zodProgram = transformDatabaseToZod(metadata, { camelCase: true });
    const output = serializeZod(zodProgram);

    expect(output).toContain('createdAt:');
    expect(output).not.toContain('created_at:');
  });

  test('should generate valid Zod schemas that parse data at runtime', async () => {
    const metadata = await introspectDatabase(db, { schemas: ['public'] });
    const zodProgram = transformDatabaseToZod(metadata);
    const code = serializeZod(zodProgram);

    const tempFile = join(import.meta.dir, '__temp_zod_test.ts');
    try {
      await writeFile(tempFile, code);
      const schemas = await import(tempFile);

      const validUser = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        created_at: new Date(),
        updated_at: null,
        is_active: true,
        metadata: null,
        tags: ['tag1', 'tag2'],
        scores: null,
      };
      const parsedUser = schemas.userSchema.parse(validUser);
      expect(parsedUser.id).toBe(1);
      expect(parsedUser.email).toBe('test@example.com');

      const validNewUser = {
        email: 'new@example.com',
        username: 'newuser',
        updated_at: null,
        metadata: null,
        tags: [],
        scores: null,
      };
      const parsedNewUser = schemas.newUserSchema.parse(validNewUser);
      expect(parsedNewUser.email).toBe('new@example.com');

      const validUpdate = { username: 'updated' };
      const parsedUpdate = schemas.userUpdateSchema.parse(validUpdate);
      expect(parsedUpdate.username).toBe('updated');

      expect(() => schemas.userSchema.parse({ id: 'not a number' })).toThrow();

    } finally {
      await unlink(tempFile).catch(() => {});
    }
  });
});
