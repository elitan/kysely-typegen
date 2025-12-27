import { SqliteDialect as KyselySqliteDialect } from 'kysely';
import type { Kysely, Dialect as KyselyDialect } from 'kysely';
import type { Dialect, IntrospectOptions, MapTypeOptions } from '@/dialects/types';
import type { DatabaseMetadata } from '@/introspect/types';
import type { TypeNode } from '@/ast/nodes';
import { introspectSqlite } from './introspect';
import { mapSqliteType } from './type-mapper';

export class SqliteDialect implements Dialect {
  readonly name = 'sqlite' as const;

  async createKyselyDialect(connectionString: string): Promise<KyselyDialect> {
    const Database = await import('better-sqlite3').then((m) => m.default);
    return new KyselySqliteDialect({
      database: new Database(connectionString),
    });
  }

  async introspect(db: Kysely<any>, options: IntrospectOptions): Promise<DatabaseMetadata> {
    return introspectSqlite(db, options);
  }

  mapType(dataType: string, options: MapTypeOptions): TypeNode {
    return mapSqliteType(dataType, options);
  }
}
