import type { Kysely, Dialect as KyselyDialect } from 'kysely';
import type { TypeNode } from '@/ast/nodes';
import type { DatabaseMetadata } from '@/introspect/types';

export type DialectName = 'postgres' | 'mysql' | 'sqlite' | 'mssql';

export type IntrospectOptions = {
  schemas: string[];
};

export type MapTypeOptions = {
  isNullable: boolean;
  isArray?: boolean;
  unknownTypes?: Set<string>;
};

export interface Dialect {
  readonly name: DialectName;
  createKyselyDialect(connectionString: string): Promise<KyselyDialect>;
  introspect(db: Kysely<any>, options: IntrospectOptions): Promise<DatabaseMetadata>;
  mapType(dataType: string, options: MapTypeOptions): TypeNode;
}
