import type {
  ArrayTypeNode,
  ConditionalTypeNode,
  DeclarationNode,
  GenericTypeNode,
  ImportNode,
  IndexAccessTypeNode,
  InferTypeNode,
  InterfaceNode,
  IntersectionTypeNode,
  KeyofTypeNode,
  LiteralNode,
  PrimitiveTypeNode,
  ProgramNode,
  PropertyNode,
  RawTypeNode,
  ReferenceTypeNode,
  TupleTypeNode,
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
    case 'tuple':
      return serializeTuple(node);
    case 'conditional':
      return serializeConditional(node);
    case 'keyof':
      return serializeKeyof(node);
    case 'indexAccess':
      return serializeIndexAccess(node);
    case 'infer':
      return serializeInfer(node);
  }
}

function serializePrimitive(node: PrimitiveTypeNode): string {
  return node.value;
}

function escapeString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function serializeLiteral(node: LiteralNode): string {
  if (typeof node.value === 'string') {
    return `'${escapeString(node.value)}'`;
  }
  return String(node.value);
}

function needsParens(node: TypeNode, context: 'union' | 'intersection' | 'array'): boolean {
  if (context === 'union' && node.kind === 'intersection') return true;
  if (context === 'intersection' && node.kind === 'union') return true;
  if (context === 'array' && (node.kind === 'union' || node.kind === 'intersection')) return true;
  return false;
}

function serializeWithParens(node: TypeNode, context: 'union' | 'intersection' | 'array'): string {
  const serialized = serializeType(node);
  return needsParens(node, context) ? `(${serialized})` : serialized;
}

function serializeUnion(node: UnionTypeNode): string {
  return node.types.map((t) => serializeWithParens(t, 'union')).join(' | ');
}

function serializeIntersection(node: IntersectionTypeNode): string {
  return node.types.map((t) => serializeWithParens(t, 'intersection')).join(' & ');
}

function serializeArray(node: ArrayTypeNode): string {
  return `${serializeWithParens(node.elementType, 'array')}[]`;
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

function serializeTuple(node: TupleTypeNode): string {
  return `[${node.elements.map(serializeType).join(', ')}]`;
}

function serializeConditional(node: ConditionalTypeNode): string {
  const check = serializeType(node.checkType);
  const ext = serializeType(node.extendsType);
  const trueType = serializeType(node.trueType);
  const falseType = serializeType(node.falseType);
  return `${check} extends ${ext} ? ${trueType} : ${falseType}`;
}

function serializeKeyof(node: KeyofTypeNode): string {
  return `keyof ${serializeType(node.type)}`;
}

function serializeIndexAccess(node: IndexAccessTypeNode): string {
  return `${serializeType(node.objectType)}[${serializeType(node.indexType)}]`;
}

function serializeInfer(node: InferTypeNode): string {
  return `infer ${node.name}`;
}

const RESERVED_WORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for',
  'function', 'if', 'import', 'in', 'instanceof', 'new', 'null', 'return', 'super',
  'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with',
  'yield', 'let', 'static', 'implements', 'interface', 'package', 'private',
  'protected', 'public', 'await', 'abstract', 'as', 'async', 'declare', 'from',
  'get', 'is', 'module', 'namespace', 'of', 'require', 'set', 'type',
]);

function needsQuotes(name: string): boolean {
  if (RESERVED_WORDS.has(name)) return true;
  if (/^\d/.test(name)) return true;
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) return true;
  return false;
}

function serializePropertyName(name: string): string {
  return needsQuotes(name) ? `'${escapeString(name)}'` : name;
}

/**
 * Serialize a PropertyNode to TypeScript property syntax
 */
function serializeProperty(node: PropertyNode, indent: string = '  '): string {
  const optional = node.optional ? '?' : '';
  const readonly = node.readonly ? 'readonly ' : '';
  const propName = serializePropertyName(node.name);
  return `${indent}${readonly}${propName}${optional}: ${serializeType(node.type)};`;
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
