export type ZodPrimitiveNode = {
  kind: 'zod-primitive';
  method: 'string' | 'number' | 'boolean' | 'bigint' | 'date' | 'unknown' | 'any' | 'null' | 'undefined' | 'never';
};

export type ZodLiteralNode = {
  kind: 'zod-literal';
  value: string | number | boolean;
};

export type ZodUnionNode = {
  kind: 'zod-union';
  schemas: ZodSchemaNode[];
};

export type ZodEnumNode = {
  kind: 'zod-enum';
  values: string[];
};

export type ZodArrayNode = {
  kind: 'zod-array';
  element: ZodSchemaNode;
};

export type ZodObjectNode = {
  kind: 'zod-object';
  properties: ZodPropertyNode[];
};

export type ZodModifiedNode = {
  kind: 'zod-modified';
  schema: ZodSchemaNode;
  modifiers: ('optional' | 'nullable')[];
};

export type ZodReferenceNode = {
  kind: 'zod-reference';
  name: string;
};

export type ZodCustomNode = {
  kind: 'zod-custom';
  typeReference: string;
};

export type ZodPropertyNode = {
  name: string;
  schema: ZodSchemaNode;
};

export type ZodSchemaNode =
  | ZodPrimitiveNode
  | ZodLiteralNode
  | ZodUnionNode
  | ZodEnumNode
  | ZodArrayNode
  | ZodObjectNode
  | ZodModifiedNode
  | ZodReferenceNode
  | ZodCustomNode;

export type ZodSchemaDeclaration = {
  kind: 'zod-schema-declaration';
  name: string;
  schema: ZodSchemaNode;
  exported: boolean;
};

export type ZodImportNode = {
  kind: 'zod-import';
};

export type ZodInferExportNode = {
  kind: 'zod-infer-export';
  typeName: string;
  schemaName: string;
};

export type ZodDeclarationNode = ZodSchemaDeclaration | ZodImportNode | ZodInferExportNode;

export type ZodProgramNode = {
  declarations: ZodDeclarationNode[];
};
