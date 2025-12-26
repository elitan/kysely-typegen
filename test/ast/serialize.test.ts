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

  describe('tuple types', () => {
    test('should serialize tuple types', () => {
      expect(serializeType({
        kind: 'tuple',
        elements: [
          { kind: 'primitive', value: 'string' },
          { kind: 'primitive', value: 'number' },
        ],
      })).toBe('[string, number]');
    });

    test('should serialize empty tuple', () => {
      expect(serializeType({ kind: 'tuple', elements: [] })).toBe('[]');
    });
  });

  describe('conditional types', () => {
    test('should serialize conditional types', () => {
      expect(serializeType({
        kind: 'conditional',
        checkType: { kind: 'reference', name: 'T' },
        extendsType: { kind: 'primitive', value: 'string' },
        trueType: { kind: 'primitive', value: 'number' },
        falseType: { kind: 'primitive', value: 'boolean' },
      })).toBe('T extends string ? number : boolean');
    });

    test('should serialize conditional with infer', () => {
      expect(serializeType({
        kind: 'conditional',
        checkType: { kind: 'reference', name: 'T' },
        extendsType: {
          kind: 'generic',
          name: 'Array',
          typeArguments: [{ kind: 'infer', name: 'U' }],
        },
        trueType: { kind: 'reference', name: 'U' },
        falseType: { kind: 'primitive', value: 'never' },
      })).toBe('T extends Array<infer U> ? U : never');
    });
  });

  describe('keyof types', () => {
    test('should serialize keyof types', () => {
      expect(serializeType({
        kind: 'keyof',
        type: { kind: 'reference', name: 'User' },
      })).toBe('keyof User');
    });
  });

  describe('index access types', () => {
    test('should serialize index access types', () => {
      expect(serializeType({
        kind: 'indexAccess',
        objectType: { kind: 'reference', name: 'Config' },
        indexType: { kind: 'literal', value: 'database' },
      })).toBe("Config['database']");
    });
  });

  describe('infer types', () => {
    test('should serialize infer types', () => {
      expect(serializeType({ kind: 'infer', name: 'T' })).toBe('infer T');
    });
  });

  describe('string escaping', () => {
    test('should escape apostrophes in string literals', () => {
      expect(serializeType({ kind: 'literal', value: "don't" })).toBe("'don\\'t'");
    });

    test('should escape backslashes in string literals', () => {
      expect(serializeType({ kind: 'literal', value: 'path\\to' })).toBe("'path\\\\to'");
    });

    test('should escape newlines in string literals', () => {
      expect(serializeType({ kind: 'literal', value: 'line1\nline2' })).toBe("'line1\\nline2'");
    });

    test('should escape tabs in string literals', () => {
      expect(serializeType({ kind: 'literal', value: 'col1\tcol2' })).toBe("'col1\\tcol2'");
    });
  });

  describe('property name quoting', () => {
    test('should quote property names with hyphens', () => {
      const iface: InterfaceNode = {
        kind: 'interface',
        name: 'Test',
        properties: [{ name: 'created-at', type: { kind: 'primitive', value: 'string' }, optional: false }],
        exported: true,
      };
      const result = serializeInterface(iface);
      expect(result).toContain("'created-at': string;");
    });

    test('should quote reserved words as property names', () => {
      const iface: InterfaceNode = {
        kind: 'interface',
        name: 'Test',
        properties: [{ name: 'class', type: { kind: 'primitive', value: 'string' }, optional: false }],
        exported: true,
      };
      const result = serializeInterface(iface);
      expect(result).toContain("'class': string;");
    });

    test('should quote property names starting with digits', () => {
      const iface: InterfaceNode = {
        kind: 'interface',
        name: 'Test',
        properties: [{ name: '123col', type: { kind: 'primitive', value: 'string' }, optional: false }],
        exported: true,
      };
      const result = serializeInterface(iface);
      expect(result).toContain("'123col': string;");
    });
  });

  describe('union/intersection parentheses', () => {
    test('should wrap union in parens when inside intersection', () => {
      const type = serializeType({
        kind: 'intersection',
        types: [
          {
            kind: 'union',
            types: [
              { kind: 'primitive', value: 'string' },
              { kind: 'primitive', value: 'number' },
            ],
          },
          { kind: 'primitive', value: 'boolean' },
        ],
      });
      expect(type).toBe('(string | number) & boolean');
    });

    test('should wrap intersection in parens when inside union', () => {
      const type = serializeType({
        kind: 'union',
        types: [
          {
            kind: 'intersection',
            types: [
              { kind: 'primitive', value: 'string' },
              { kind: 'primitive', value: 'number' },
            ],
          },
          { kind: 'primitive', value: 'boolean' },
        ],
      });
      expect(type).toBe('(string & number) | boolean');
    });

    test('should wrap union in parens when used as array element type', () => {
      const type = serializeType({
        kind: 'array',
        elementType: {
          kind: 'union',
          types: [
            { kind: 'primitive', value: 'string' },
            { kind: 'primitive', value: 'number' },
          ],
        },
      });
      expect(type).toBe('(string | number)[]');
    });
  });

  describe('field ordering', () => {
    test('should preserve order of properties as provided', () => {
      const userInterface: InterfaceNode = {
        kind: 'interface',
        name: 'User',
        properties: [
          { name: 'zebra', type: { kind: 'primitive', value: 'string' }, optional: false },
          { name: 'apple', type: { kind: 'primitive', value: 'string' }, optional: false },
          { name: 'banana', type: { kind: 'primitive', value: 'string' }, optional: false },
        ],
        exported: true,
      };

      const result = serializeInterface(userInterface);
      const lines = result.split('\n');

      expect(lines[1]).toContain('zebra');
      expect(lines[2]).toContain('apple');
      expect(lines[3]).toContain('banana');
    });

    test('should handle mixed case properties', () => {
      const userInterface: InterfaceNode = {
        kind: 'interface',
        name: 'User',
        properties: [
          { name: 'userId', type: { kind: 'primitive', value: 'number' }, optional: false },
          { name: 'userName', type: { kind: 'primitive', value: 'string' }, optional: false },
          { name: 'userEmail', type: { kind: 'primitive', value: 'string' }, optional: false },
        ],
        exported: true,
      };

      const result = serializeInterface(userInterface);
      expect(result).toContain('userId');
      expect(result).toContain('userName');
      expect(result).toContain('userEmail');
    });

    test('should handle properties with underscores', () => {
      const userInterface: InterfaceNode = {
        kind: 'interface',
        name: 'User',
        properties: [
          { name: '_internal', type: { kind: 'primitive', value: 'string' }, optional: false },
          { name: 'public_field', type: { kind: 'primitive', value: 'string' }, optional: false },
          { name: 'created_at', type: { kind: 'primitive', value: 'Date' }, optional: false },
        ],
        exported: true,
      };

      const result = serializeInterface(userInterface);
      expect(result).toContain('_internal');
      expect(result).toContain('public_field');
      expect(result).toContain('created_at');
    });
  });
});
