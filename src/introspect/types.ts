/**
 * Metadata types for database introspection
 */

export type ColumnMetadata = {
  name: string;
  dataType: string;
  isNullable: boolean;
  isAutoIncrement: boolean;
  hasDefaultValue: boolean;
  comment?: string;
};

export type TableMetadata = {
  schema: string;
  name: string;
  columns: ColumnMetadata[];
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
