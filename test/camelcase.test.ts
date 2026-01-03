import { describe, expect, test } from 'bun:test';
import { serialize } from '@/ast/serialize';
import type { DatabaseMetadata } from '@/introspect/types';
import { transformDatabase } from '@/transform';
import { toCamelCase } from '@/utils/case-converter';

describe('CamelCase Support', () => {
  describe('toCamelCase utility', () => {
    test('should convert snake_case to camelCase', () => {
      expect(toCamelCase('foo_bar')).toBe('fooBar');
      expect(toCamelCase('created_at')).toBe('createdAt');
      expect(toCamelCase('user_id')).toBe('userId');
      expect(toCamelCase('is_active')).toBe('isActive');
    });

    test('should handle single words', () => {
      expect(toCamelCase('id')).toBe('id');
      expect(toCamelCase('name')).toBe('name');
    });

    test('should handle multiple underscores', () => {
      expect(toCamelCase('foo_bar_baz')).toBe('fooBarBaz');
      expect(toCamelCase('created_at_timestamp')).toBe('createdAtTimestamp');
    });
  });

  describe('transformDatabase with camelCase option', () => {
    const metadata: DatabaseMetadata = {
      tables: [
        {
          schema: 'public',
          name: 'user_profiles',
          columns: [
            {
              name: 'user_id',
              dataType: 'int4',
              isNullable: false,
              isAutoIncrement: true,
              hasDefaultValue: true,
            },
            {
              name: 'first_name',
              dataType: 'varchar',
              isNullable: false,
              isAutoIncrement: false,
              hasDefaultValue: false,
            },
            {
              name: 'last_name',
              dataType: 'varchar',
              isNullable: false,
              isAutoIncrement: false,
              hasDefaultValue: false,
            },
            {
              name: 'created_at',
              dataType: 'timestamp',
              isNullable: false,
              isAutoIncrement: false,
              hasDefaultValue: true,
            },
          ],
        },
      ],
      enums: [],
    };

    test('should convert column names to camelCase', () => {
      const { program } = transformDatabase(metadata, { camelCase: true });
      const code = serialize(program);

      expect(code).toContain('userId: Generated<number>');
      expect(code).toContain('firstName: string');
      expect(code).toContain('lastName: string');
      expect(code).toContain('createdAt: Generated<Timestamp>');
    });

    test('should convert table names in DB interface to camelCase', () => {
      const { program } = transformDatabase(metadata, { camelCase: true });
      const code = serialize(program);

      expect(code).toContain('userProfiles: UserProfile');
    });

    test('should keep interface names as PascalCase', () => {
      const { program } = transformDatabase(metadata, { camelCase: true });
      const code = serialize(program);

      expect(code).toContain('export interface UserProfile {');
    });

    test('should not convert names when camelCase is false', () => {
      const { program } = transformDatabase(metadata, { camelCase: false });
      const code = serialize(program);

      expect(code).toContain('user_id: Generated<number>');
      expect(code).toContain('first_name: string');
      expect(code).toContain('user_profiles: UserProfile');
    });

    test('should not convert names when camelCase is undefined', () => {
      const { program } = transformDatabase(metadata);
      const code = serialize(program);

      expect(code).toContain('user_id: Generated<number>');
      expect(code).toContain('first_name: string');
      expect(code).toContain('user_profiles: UserProfile');
    });

    test('should work with enum columns', () => {
      const metadataWithEnum: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'user_profiles',
            columns: [
              {
                name: 'account_status',
                dataType: 'status_enum',
                isNullable: false,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
            ],
          },
        ],
        enums: [
          {
            schema: 'public',
            name: 'status_enum',
            values: ['active', 'inactive'],
          },
        ],
      };

      const { program } = transformDatabase(metadataWithEnum, { camelCase: true });
      const code = serialize(program);

      expect(code).toContain('accountStatus: StatusEnum');
    });

    test('should work with nullable columns', () => {
      const metadataWithNullable: DatabaseMetadata = {
        tables: [
          {
            schema: 'public',
            name: 'users',
            columns: [
              {
                name: 'middle_name',
                dataType: 'varchar',
                isNullable: true,
                isAutoIncrement: false,
                hasDefaultValue: false,
              },
            ],
          },
        ],
        enums: [],
      };

      const { program } = transformDatabase(metadataWithNullable, { camelCase: true });
      const code = serialize(program);

      expect(code).toContain('middleName: string | null');
    });
  });
});
