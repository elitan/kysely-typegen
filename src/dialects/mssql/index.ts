import { MssqlDialect as KyselyMssqlDialect } from 'kysely';
import type { Kysely, Dialect as KyselyDialect } from 'kysely';
import type { Dialect, IntrospectOptions, MapTypeOptions } from '@/dialects/types';
import type { DatabaseMetadata } from '@/introspect/types';
import type { TypeNode } from '@/ast/nodes';
import { introspectMssql } from './introspect';
import { mapMssqlType } from './type-mapper';

const DEFAULT_MSSQL_PORT = 1433;

type ConnectionConfig = {
  server: string;
  port: number | undefined;
  instanceName: string | undefined;
  database: string;
  userName: string;
  password: string;
};

export class MssqlDialect implements Dialect {
  readonly name = 'mssql' as const;

  async createKyselyDialect(connectionString: string): Promise<KyselyDialect> {
    const tarn = await import('tarn');
    const tedious = await import('tedious');

    const config = await this.parseConnectionString(connectionString);

    return new KyselyMssqlDialect({
      tarn: {
        ...tarn,
        options: { min: 0, max: 1 },
      },
      tedious: {
        ...tedious,
        connectionFactory: () => {
          return new tedious.Connection({
            authentication: {
              options: { password: config.password, userName: config.userName },
              type: 'default',
            },
            options: {
              database: config.database,
              encrypt: true,
              instanceName: config.instanceName,
              port: config.port,
              trustServerCertificate: true,
            },
            server: config.server,
          });
        },
      },
    });
  }

  async introspect(db: Kysely<any>, options: IntrospectOptions): Promise<DatabaseMetadata> {
    return introspectMssql(db, options);
  }

  mapType(dataType: string, options: MapTypeOptions): TypeNode {
    return mapMssqlType(dataType, options);
  }

  private async parseConnectionString(connectionString: string): Promise<ConnectionConfig> {
    if (connectionString.startsWith('mssql://') || connectionString.startsWith('sqlserver://')) {
      return this.parseUrlFormat(connectionString);
    }

    return this.parseAdoNetFormat(connectionString);
  }

  private parseUrlFormat(connectionString: string): ConnectionConfig {
    const url = new URL(connectionString);
    return {
      server: url.hostname,
      port: url.port ? parseInt(url.port, 10) : DEFAULT_MSSQL_PORT,
      instanceName: undefined,
      database: url.pathname.slice(1),
      userName: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    };
  }

  private async parseAdoNetFormat(connectionString: string): Promise<ConnectionConfig> {
    const { parseConnectionString } = await import('@tediousjs/connection-string');

    const parsed = parseConnectionString(connectionString) as Record<string, string>;
    const serverValue = parsed.server || parsed['data source'] || 'localhost';
    const tokens = serverValue.split(',');
    const serverAndInstance = tokens[0]!.split('\\');
    const server = serverAndInstance[0]!;
    const instanceName = serverAndInstance[1];

    const port =
      instanceName === undefined
        ? tokens[1]
          ? parseInt(tokens[1], 10)
          : DEFAULT_MSSQL_PORT
        : undefined;

    return {
      server,
      port,
      instanceName,
      database: parsed.database || parsed['initial catalog'] || '',
      userName: parsed['user id'] || '',
      password: parsed.password || '',
    };
  }
}
