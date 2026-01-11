import type {
  ZodArrayNode,
  ZodCustomNode,
  ZodDeclarationNode,
  ZodEnumNode,
  ZodInferExportNode,
  ZodLiteralNode,
  ZodModifiedNode,
  ZodObjectNode,
  ZodPrimitiveNode,
  ZodProgramNode,
  ZodPropertyNode,
  ZodReferenceNode,
  ZodSchemaDeclaration,
  ZodSchemaNode,
  ZodTransformNode,
  ZodUnionNode,
} from './nodes';

const RESERVED_WORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for',
  'function', 'if', 'import', 'in', 'instanceof', 'new', 'null', 'return', 'super',
  'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with',
  'yield', 'let', 'static', 'implements', 'interface', 'package', 'private',
  'protected', 'public', 'await', 'abstract', 'as', 'async', 'declare', 'from',
  'get', 'is', 'module', 'namespace', 'of', 'require', 'set', 'type',
]);

function escapeString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function needsQuotes(name: string): boolean {
  if (RESERVED_WORDS.has(name)) return true;
  if (/^\d/.test(name)) return true;
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) return true;
  return false;
}

function serializePropertyName(name: string): string {
  return needsQuotes(name) ? `'${escapeString(name)}'` : name;
}

export function serializeZodSchema(node: ZodSchemaNode): string {
  switch (node.kind) {
    case 'zod-primitive':
      return serializeZodPrimitive(node);
    case 'zod-literal':
      return serializeZodLiteral(node);
    case 'zod-union':
      return serializeZodUnion(node);
    case 'zod-enum':
      return serializeZodEnum(node);
    case 'zod-array':
      return serializeZodArray(node);
    case 'zod-object':
      return serializeZodObject(node);
    case 'zod-modified':
      return serializeZodModified(node);
    case 'zod-reference':
      return serializeZodReference(node);
    case 'zod-custom':
      return serializeZodCustom(node);
    case 'zod-transform':
      return serializeZodTransform(node);
  }
}

function serializeZodPrimitive(node: ZodPrimitiveNode): string {
  return `z.${node.method}()`;
}

function serializeZodLiteral(node: ZodLiteralNode): string {
  if (typeof node.value === 'string') {
    return `z.literal('${escapeString(node.value)}')`;
  }
  return `z.literal(${node.value})`;
}

function serializeZodUnion(node: ZodUnionNode): string {
  const schemas = node.schemas.map(serializeZodSchema).join(', ');
  return `z.union([${schemas}])`;
}

function serializeZodEnum(node: ZodEnumNode): string {
  const values = node.values.map((v) => `'${escapeString(v)}'`).join(', ');
  return `z.enum([${values}])`;
}

function serializeZodArray(node: ZodArrayNode): string {
  return `z.array(${serializeZodSchema(node.element)})`;
}

function serializeZodObject(node: ZodObjectNode): string {
  if (node.properties.length === 0) {
    return 'z.object({})';
  }
  const props = node.properties.map((p) => serializeZodProperty(p)).join(',\n');
  return `z.object({\n${props},\n})`;
}

function serializeZodProperty(node: ZodPropertyNode): string {
  const name = serializePropertyName(node.name);
  return `  ${name}: ${serializeZodSchema(node.schema)}`;
}

function serializeZodModified(node: ZodModifiedNode): string {
  let result = serializeZodSchema(node.schema);
  for (const mod of node.modifiers) {
    result += `.${mod}()`;
  }
  return result;
}

function serializeZodReference(node: ZodReferenceNode): string {
  return node.name;
}

function serializeZodCustom(node: ZodCustomNode): string {
  return `z.custom<${node.typeReference}>()`;
}

function serializeZodTransform(node: ZodTransformNode): string {
  return `${serializeZodSchema(node.schema)}.transform(${node.transformFn})`;
}

function serializeZodDeclaration(node: ZodDeclarationNode): string {
  switch (node.kind) {
    case 'zod-import':
      return "import { z } from 'zod';";
    case 'zod-schema-declaration':
      return serializeZodSchemaDeclaration(node);
    case 'zod-infer-export':
      return serializeZodInferExport(node);
  }
}

function serializeZodSchemaDeclaration(node: ZodSchemaDeclaration): string {
  const exported = node.exported ? 'export ' : '';
  return `${exported}const ${node.name} = ${serializeZodSchema(node.schema)};`;
}

function serializeZodInferExport(node: ZodInferExportNode): string {
  return `export type ${node.typeName} = z.infer<typeof ${node.schemaName}>;`;
}

export function serializeZod(program: ZodProgramNode): string {
  return program.declarations.map(serializeZodDeclaration).join('\n\n') + '\n';
}
