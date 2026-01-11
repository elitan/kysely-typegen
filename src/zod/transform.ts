import type { DatabaseMetadata, TableMetadata, ColumnMetadata, EnumMetadata } from '@/introspect/types';
import type {
  ZodProgramNode,
  ZodDeclarationNode,
  ZodSchemaDeclaration,
  ZodPropertyNode,
  ZodSchemaNode,
  ZodInferExportNode,
} from './nodes';
import { mapPostgresTypeToZod } from './type-mapper';
import { toCamelCase } from '@/utils/case-converter';
import { toPascalCase, singularize } from '@/transform/utils';
import { EnumNameResolver } from '@/transform/enum';

export type ZodTransformOptions = {
  camelCase?: boolean;
};

function uncapitalize(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function getSchemaName(baseName: string, mode: 'select' | 'insert' | 'update'): string {
  const uncap = uncapitalize(baseName);
  switch (mode) {
    case 'select':
      return `${uncap}Schema`;
    case 'insert':
      return `new${baseName}Schema`;
    case 'update':
      return `${uncap}UpdateSchema`;
  }
}

function getTypeName(baseName: string, mode: 'select' | 'insert' | 'update'): string {
  switch (mode) {
    case 'select':
      return baseName;
    case 'insert':
      return `New${baseName}`;
    case 'update':
      return `${baseName}Update`;
  }
}

function transformEnumToZod(enumMeta: EnumMetadata, resolver: EnumNameResolver): ZodSchemaDeclaration {
  const name = resolver.getName(enumMeta);
  return {
    kind: 'zod-schema-declaration',
    name: `${uncapitalize(name)}Schema`,
    schema: {
      kind: 'zod-enum',
      values: enumMeta.values,
    },
    exported: true,
  };
}

function transformColumnToZod(
  column: ColumnMetadata,
  enums: EnumMetadata[],
  enumResolver: EnumNameResolver,
  mode: 'select' | 'insert' | 'update',
  options?: ZodTransformOptions
): ZodPropertyNode {
  const columnName = options?.camelCase ? toCamelCase(column.name) : column.name;

  const matchingEnum = enums.find(
    (e) => e.name === column.dataType && e.schema === (column.dataTypeSchema ?? 'public')
  );

  let schema: ZodSchemaNode;

  const modifiers: ('nullable' | 'optional')[] = [];
  if (column.isNullable) modifiers.push('nullable');
  const isOptional =
    mode === 'update' || (mode === 'insert' && (column.isAutoIncrement || column.hasDefaultValue));
  if (isOptional) modifiers.push('optional');

  if (matchingEnum) {
    const enumName = enumResolver.getName(matchingEnum);
    schema = { kind: 'zod-reference', name: `${uncapitalize(enumName)}Schema` };

    if (modifiers.length > 0) {
      schema = { kind: 'zod-modified', schema, modifiers };
    }
  } else if (column.checkConstraint) {
    if (column.checkConstraint.type === 'boolean') {
      schema = { kind: 'zod-primitive', method: 'boolean' };
    } else if (column.checkConstraint.type === 'string') {
      schema = { kind: 'zod-enum', values: column.checkConstraint.values };
    } else {
      schema = {
        kind: 'zod-union',
        schemas: column.checkConstraint.values.map((v) => ({
          kind: 'zod-literal' as const,
          value: v,
        })),
      };
    }

    if (modifiers.length > 0) {
      schema = { kind: 'zod-modified', schema, modifiers };
    }
  } else {
    schema = mapPostgresTypeToZod(column.dataType, {
      isNullable: column.isNullable,
      isArray: column.isArray,
      isOptional,
      mode,
    });
  }

  return { name: columnName, schema };
}

function transformTableToZod(
  table: TableMetadata,
  enums: EnumMetadata[],
  enumResolver: EnumNameResolver,
  mode: 'select' | 'insert' | 'update',
  options?: ZodTransformOptions
): ZodSchemaDeclaration {
  const baseName = toPascalCase(singularize(table.name));
  const schemaName = getSchemaName(baseName, mode);

  const properties = table.columns.map((col) =>
    transformColumnToZod(col, enums, enumResolver, mode, options)
  );

  return {
    kind: 'zod-schema-declaration',
    name: schemaName,
    schema: { kind: 'zod-object', properties },
    exported: true,
  };
}

function createInferExport(baseName: string, mode: 'select' | 'insert' | 'update'): ZodInferExportNode {
  return {
    kind: 'zod-infer-export',
    typeName: getTypeName(baseName, mode),
    schemaName: getSchemaName(baseName, mode),
  };
}

export function transformDatabaseToZod(
  metadata: DatabaseMetadata,
  options?: ZodTransformOptions
): ZodProgramNode {
  const declarations: ZodDeclarationNode[] = [];

  declarations.push({ kind: 'zod-import' });

  const enumResolver = new EnumNameResolver(metadata.enums);

  for (const enumMeta of metadata.enums) {
    declarations.push(transformEnumToZod(enumMeta, enumResolver));
  }

  for (const table of metadata.tables) {
    const baseName = toPascalCase(singularize(table.name));

    declarations.push(transformTableToZod(table, metadata.enums, enumResolver, 'select', options));
    declarations.push(transformTableToZod(table, metadata.enums, enumResolver, 'insert', options));
    declarations.push(transformTableToZod(table, metadata.enums, enumResolver, 'update', options));

    declarations.push(createInferExport(baseName, 'select'));
    declarations.push(createInferExport(baseName, 'insert'));
    declarations.push(createInferExport(baseName, 'update'));
  }

  return { declarations };
}
