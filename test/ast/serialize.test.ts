import { describe, expect, test } from 'bun:test';
import type {
  InterfaceNode,
  ProgramNode,
  TypeAliasNode,
  ImportNode,
} from '@/ast/nodes';
import { serialize, serializeType, serializeInterface, serializeImport } from '@/ast/serialize';

describe('Serializer', () => {
  describe('serializeType', () => {
    test('should serialize primitive types', () => {
      expect(serializeType({ kind: 'primitive', value: 'string' })).toBe('string');
      expect(serializeType({ kind: 'primitive', value: 'number' })).toBe('number');
      expect(serializeType({ kind: 'primitive', value: 'boolean' })).toBe('boolean');
    });

    test('should serialize string literals with quotes', () => {
      expect(serializeType({ kind: 'literal', value: 'active' })).toBe("'active'");
    });

    test('should serialize number literals without quotes', () => {
      expect(serializeType({ kind: 'literal', value: 42 })).toBe('42');
    });

    test('should serialize boolean literals', () => {
      expect(serializeType({ kind: 'literal', value: true })).toBe('true');
      expect(serializeType({ kind: 'literal', value: false })).toBe('false');
    });

    test('should serialize union types', () => {
      const union = serializeType({
        kind: 'union',
        types: [
          { kind: 'literal', value: 'pending' },
          { kind: 'literal', value: 'approved' },
          { kind: 'literal', value: 'rejected' },
        ],
      });

      expect(union).toBe("'pending' | 'approved' | 'rejected'");
    });

    test('should serialize union with null', () => {
      const union = serializeType({
        kind: 'union',
        types: [
          { kind: 'primitive', value: 'string' },
          { kind: 'primitive', value: 'null' },
        ],
      });

      expect(union).toBe('string | null');
    });

    test('should serialize generic types', () => {
      const generated = serializeType({
        kind: 'generic',
        name: 'Generated',
        typeArguments: [{ kind: 'primitive', value: 'number' }],
      });

      expect(generated).toBe('Generated<number>');
    });

    test('should serialize nested generics', () => {
      const columnType = serializeType({
        kind: 'generic',
        name: 'ColumnType',
        typeArguments: [
          { kind: 'primitive', value: 'Date' },
          {
            kind: 'union',
            types: [
              { kind: 'primitive', value: 'Date' },
              { kind: 'primitive', value: 'string' },
            ],
          },
          {
            kind: 'union',
            types: [
              { kind: 'primitive', value: 'Date' },
              { kind: 'primitive', value: 'string' },
            ],
          },
        ],
      });

      expect(columnType).toBe('ColumnType<Date, Date | string, Date | string>');
    });

    test('should serialize array types', () => {
      expect(serializeType({
        kind: 'array',
        elementType: { kind: 'primitive', value: 'string' },
      })).toBe('string[]');
    });

    test('should serialize reference types', () => {
      expect(serializeType({
        kind: 'reference',
        name: 'User',
      })).toBe('User');
    });
  });

  describe('serializeInterface', () => {
    test('should serialize interface with basic properties', () => {
      const userInterface: InterfaceNode = {
        kind: 'interface',
        name: 'User',
        properties: [
          { name: 'id', type: { kind: 'primitive', value: 'number' }, optional: false },
          { name: 'email', type: { kind: 'primitive', value: 'string' }, optional: false },
        ],
        exported: true,
      };

      const result = serializeInterface(userInterface);
      expect(result).toContain('export interface User {');
      expect(result).toContain('  id: number;');
      expect(result).toContain('  email: string;');
      expect(result).toContain('}');
    });

    test('should serialize interface with optional properties', () => {
      const userInterface: InterfaceNode = {
        kind: 'interface',
        name: 'User',
        properties: [
          { name: 'bio', type: { kind: 'primitive', value: 'string' }, optional: true },
        ],
        exported: true,
      };

      const result = serializeInterface(userInterface);
      expect(result).toContain('  bio?: string;');
    });

    test('should serialize non-exported interface', () => {
      const userInterface: InterfaceNode = {
        kind: 'interface',
        name: 'Internal',
        properties: [],
        exported: false,
      };

      const result = serializeInterface(userInterface);
      expect(result).toContain('interface Internal {');
      expect(result).not.toContain('export');
    });
  });

  describe('serializeImport', () => {
    test('should serialize type-only imports', () => {
      const importNode: ImportNode = {
        kind: 'import',
        imports: ['ColumnType', 'Generated'],
        from: 'kysely',
        typeOnly: true,
      };

      const result = serializeImport(importNode);
      expect(result).toBe("import type { ColumnType, Generated } from 'kysely';");
    });

    test('should serialize regular imports', () => {
      const importNode: ImportNode = {
        kind: 'import',
        imports: ['Kysely'],
        from: 'kysely',
        typeOnly: false,
      };

      const result = serializeImport(importNode);
      expect(result).toBe("import { Kysely } from 'kysely';");
    });
  });

  describe('serialize (full program)', () => {
    test('should serialize a complete program with imports and interfaces', () => {
      const program: ProgramNode = {
        declarations: [
          {
            kind: 'import',
            imports: ['ColumnType', 'Generated'],
            from: 'kysely',
            typeOnly: true,
          },
          {
            kind: 'interface',
            name: 'User',
            properties: [
              {
                name: 'id',
                type: {
                  kind: 'generic',
                  name: 'Generated',
                  typeArguments: [{ kind: 'primitive', value: 'number' }],
                },
                optional: false,
              },
              { name: 'email', type: { kind: 'primitive', value: 'string' }, optional: false },
            ],
            exported: true,
          },
          {
            kind: 'interface',
            name: 'DB',
            properties: [
              { name: 'user', type: { kind: 'reference', name: 'User' }, optional: false },
            ],
            exported: true,
          },
        ],
      };

      const result = serialize(program);
      expect(result).toContain("import type { ColumnType, Generated } from 'kysely';");
      expect(result).toContain('export interface User {');
      expect(result).toContain('export interface DB {');
      expect(result).toContain('  user: User;');
    });
  });
});
