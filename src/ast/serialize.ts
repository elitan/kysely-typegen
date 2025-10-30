import type {
  ArrayTypeNode,
  DeclarationNode,
  GenericTypeNode,
  ImportNode,
  InterfaceNode,
  IntersectionTypeNode,
  LiteralNode,
  PrimitiveTypeNode,
  ProgramNode,
  PropertyNode,
  RawTypeNode,
  ReferenceTypeNode,
  TypeAliasNode,
  TypeNode,
  UnionTypeNode,
} from './nodes';

/**
 * Serialize a TypeNode to TypeScript code
 */
export function serializeType(node: TypeNode): string {
  switch (node.kind) {
    case 'primitive':
      return serializePrimitive(node);
    case 'literal':
      return serializeLiteral(node);
    case 'union':
      return serializeUnion(node);
    case 'intersection':
      return serializeIntersection(node);
    case 'array':
      return serializeArray(node);
    case 'generic':
      return serializeGeneric(node);
    case 'reference':
      return serializeReference(node);
    case 'raw':
      return serializeRaw(node);
  }
}

function serializePrimitive(node: PrimitiveTypeNode): string {
  return node.value;
}

function serializeLiteral(node: LiteralNode): string {
  if (typeof node.value === 'string') {
    return `'${node.value}'`;
  }
  return String(node.value);
}

function serializeUnion(node: UnionTypeNode): string {
  return node.types.map(serializeType).join(' | ');
}

function serializeIntersection(node: IntersectionTypeNode): string {
  return node.types.map(serializeType).join(' & ');
}

function serializeArray(node: ArrayTypeNode): string {
  return `${serializeType(node.elementType)}[]`;
}

function serializeGeneric(node: GenericTypeNode): string {
  const typeArgs = node.typeArguments.map(serializeType).join(', ');
  return `${node.name}<${typeArgs}>`;
}

function serializeReference(node: ReferenceTypeNode): string {
  return node.name;
}

function serializeRaw(node: RawTypeNode): string {
  return node.value;
}

/**
 * Serialize a PropertyNode to TypeScript property syntax
 */
function serializeProperty(node: PropertyNode, indent: string = '  '): string {
  const optional = node.optional ? '?' : '';
  const readonly = node.readonly ? 'readonly ' : '';
  return `${indent}${readonly}${node.name}${optional}: ${serializeType(node.type)};`;
}

/**
 * Serialize an InterfaceNode to TypeScript interface
 */
export function serializeInterface(node: InterfaceNode): string {
  const exported = node.exported ? 'export ' : '';
  const properties = node.properties.map((prop) => serializeProperty(prop)).join('\n');

  return `${exported}interface ${node.name} {
${properties}
}`;
}

/**
 * Serialize a TypeAliasNode to TypeScript type alias
 */
function serializeTypeAlias(node: TypeAliasNode): string {
  const exported = node.exported ? 'export ' : '';
  return `${exported}type ${node.name} = ${serializeType(node.type)};`;
}

/**
 * Serialize an ImportNode to TypeScript import statement
 */
export function serializeImport(node: ImportNode): string {
  const typeOnly = node.typeOnly ? ' type' : '';
  const imports = node.imports.join(', ');
  return `import${typeOnly} { ${imports} } from '${node.from}';`;
}

/**
 * Serialize a DeclarationNode
 */
function serializeDeclaration(node: DeclarationNode): string {
  switch (node.kind) {
    case 'interface':
      return serializeInterface(node);
    case 'typeAlias':
      return serializeTypeAlias(node);
    case 'import':
      return serializeImport(node);
  }
}

/**
 * Serialize a complete program (AST) to TypeScript code
 */
export function serialize(program: ProgramNode): string {
  return program.declarations.map(serializeDeclaration).join('\n\n') + '\n';
}
