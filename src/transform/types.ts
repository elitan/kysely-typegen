import type { ProgramNode, TypeNode } from '@/ast/nodes';
import type { DialectName } from '@/dialects/types';

export type TypeMapper = (
  dataType: string,
  options: { isNullable: boolean; isArray?: boolean; unknownTypes?: Set<string>; usedHelpers?: Set<string> }
) => TypeNode;

export type TransformOptions = {
  camelCase?: boolean;
  includePattern?: string[];
  excludePattern?: string[];
  dialectName?: DialectName;
  mapType?: TypeMapper;
  noBooleanCoerce?: boolean;
};

export type TransformWarning = {
  type: 'unknown_type';
  pgType: string;
};

export type TransformResult = {
  program: ProgramNode;
  warnings: TransformWarning[];
};
