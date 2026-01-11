/**
 * Metadata types for database introspection
 */

export type CheckConstraintValues =
  | { type: 'string'; values: string[] }
  | { type: 'number'; values: number[] };

export type ColumnMetadata = {
  name: string;
  dataType: string;
  dataTypeSchema?: string;
  isNullable: boolean;
  isAutoIncrement: boolean;
  hasDefaultValue: boolean;
  isArray?: boolean;
  comment?: string;
  checkConstraint?: CheckConstraintValues;
  domainName?: string;
  domainSchema?: string;
};

export type TableMetadata = {
  schema: string;
  name: string;
  columns: ColumnMetadata[];
  isView?: boolean;
  isPartition?: boolean;
  comment?: string;
};

export type EnumMetadata = {
  schema: string;
  name: string;
  values: string[];
};

export type DatabaseMetadata = {
  tables: TableMetadata[];
  enums: EnumMetadata[];
};
