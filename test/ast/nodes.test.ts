import { describe, expect, test } from 'bun:test';
import type {
  ArrayTypeNode,
  ConditionalTypeNode,
  GenericTypeNode,
  IndexAccessTypeNode,
  InferTypeNode,
  InterfaceNode,
  KeyofTypeNode,
  LiteralNode,
  PrimitiveTypeNode,
  PropertyNode,
  TupleTypeNode,
  UnionTypeNode,
} from '@/ast/nodes';

describe('AST Nodes', () => {
  test('PrimitiveTypeNode should represent basic types', () => {
    const stringType: PrimitiveTypeNode = {
      kind: 'primitive',
      value: 'string',
    };

    expect(stringType.kind).toBe('primitive');
    expect(stringType.value).toBe('string');
  });

  test('LiteralNode should represent literal values', () => {
    const stringLiteral: LiteralNode = {
      kind: 'literal',
      value: 'active',
    };

    const numberLiteral: LiteralNode = {
      kind: 'literal',
      value: 42,
    };

    expect(stringLiteral.value).toBe('active');
    expect(numberLiteral.value).toBe(42);
  });

  test('UnionTypeNode should combine multiple types', () => {
    const union: UnionTypeNode = {
      kind: 'union',
      types: [
        { kind: 'literal', value: 'pending' },
        { kind: 'literal', value: 'approved' },
        { kind: 'literal', value: 'rejected' },
      ],
    };

    expect(union.types).toHaveLength(3);
    expect(union.types[0]?.kind).toBe('literal');
  });

  test('GenericTypeNode should represent generic types', () => {
    const generated: GenericTypeNode = {
      kind: 'generic',
      name: 'Generated',
      typeArguments: [{ kind: 'primitive', value: 'number' }],
    };

    expect(generated.name).toBe('Generated');
    expect(generated.typeArguments).toHaveLength(1);
    expect(generated.typeArguments[0]?.kind).toBe('primitive');
  });

  test('ArrayTypeNode should represent array types', () => {
    const stringArray: ArrayTypeNode = {
      kind: 'array',
      elementType: { kind: 'primitive', value: 'string' },
    };

    expect(stringArray.kind).toBe('array');
    expect(stringArray.elementType.kind).toBe('primitive');
  });

  test('PropertyNode should represent interface properties', () => {
    const property: PropertyNode = {
      name: 'email',
      type: { kind: 'primitive', value: 'string' },
      optional: false,
    };

    expect(property.name).toBe('email');
    expect(property.optional).toBe(false);
  });

  test('PropertyNode can be optional', () => {
    const optionalProperty: PropertyNode = {
      name: 'bio',
      type: { kind: 'primitive', value: 'string' },
      optional: true,
    };

    expect(optionalProperty.optional).toBe(true);
  });

  test('InterfaceNode should represent TypeScript interfaces', () => {
    const userInterface: InterfaceNode = {
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
        {
          name: 'email',
          type: { kind: 'primitive', value: 'string' },
          optional: false,
        },
      ],
      exported: true,
    };

    expect(userInterface.name).toBe('User');
    expect(userInterface.properties).toHaveLength(2);
    expect(userInterface.exported).toBe(true);
  });

  test('TupleTypeNode should represent tuple types', () => {
    const tuple: TupleTypeNode = {
      kind: 'tuple',
      elements: [
        { kind: 'primitive', value: 'string' },
        { kind: 'primitive', value: 'number' },
      ],
    };

    expect(tuple.kind).toBe('tuple');
    expect(tuple.elements).toHaveLength(2);
  });

  test('ConditionalTypeNode should represent conditional types', () => {
    const conditional: ConditionalTypeNode = {
      kind: 'conditional',
      checkType: { kind: 'reference', name: 'T' },
      extendsType: { kind: 'primitive', value: 'string' },
      trueType: { kind: 'primitive', value: 'number' },
      falseType: { kind: 'primitive', value: 'boolean' },
    };

    expect(conditional.kind).toBe('conditional');
    expect(conditional.checkType.kind).toBe('reference');
    expect(conditional.extendsType.kind).toBe('primitive');
  });

  test('KeyofTypeNode should represent keyof types', () => {
    const keyof: KeyofTypeNode = {
      kind: 'keyof',
      type: { kind: 'reference', name: 'User' },
    };

    expect(keyof.kind).toBe('keyof');
    expect(keyof.type.kind).toBe('reference');
  });

  test('IndexAccessTypeNode should represent index access types', () => {
    const indexAccess: IndexAccessTypeNode = {
      kind: 'indexAccess',
      objectType: { kind: 'reference', name: 'Config' },
      indexType: { kind: 'literal', value: 'database' },
    };

    expect(indexAccess.kind).toBe('indexAccess');
    expect(indexAccess.objectType.kind).toBe('reference');
    expect(indexAccess.indexType.kind).toBe('literal');
  });

  test('InferTypeNode should represent infer types', () => {
    const infer: InferTypeNode = {
      kind: 'infer',
      name: 'U',
    };

    expect(infer.kind).toBe('infer');
    expect(infer.name).toBe('U');
  });
});
