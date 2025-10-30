/**
 * AST node types for TypeScript code generation
 */

export type PrimitiveTypeNode = {
  kind: 'primitive';
  value: 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'unknown' | 'any';
};

export type LiteralNode = {
  kind: 'literal';
  value: string | number | boolean;
};

export type UnionTypeNode = {
  kind: 'union';
  types: TypeNode[];
};

export type IntersectionTypeNode = {
  kind: 'intersection';
  types: TypeNode[];
};

export type ArrayTypeNode = {
  kind: 'array';
  elementType: TypeNode;
};

export type GenericTypeNode = {
  kind: 'generic';
  name: string;
  typeArguments: TypeNode[];
};

export type ReferenceTypeNode = {
  kind: 'reference';
  name: string;
};

export type RawTypeNode = {
  kind: 'raw';
  value: string;
};

export type TypeNode =
  | PrimitiveTypeNode
  | LiteralNode
  | UnionTypeNode
  | IntersectionTypeNode
  | ArrayTypeNode
  | GenericTypeNode
  | ReferenceTypeNode
  | RawTypeNode;

export type PropertyNode = {
  name: string;
  type: TypeNode;
  optional: boolean;
  readonly?: boolean;
};

export type InterfaceNode = {
  kind: 'interface';
  name: string;
  properties: PropertyNode[];
  exported: boolean;
};

export type TypeAliasNode = {
  kind: 'typeAlias';
  name: string;
  type: TypeNode;
  exported: boolean;
};

export type ImportNode = {
  kind: 'import';
  imports: string[];
  from: string;
  typeOnly: boolean;
};

export type DeclarationNode = InterfaceNode | TypeAliasNode | ImportNode;

export type ProgramNode = {
  declarations: DeclarationNode[];
};
