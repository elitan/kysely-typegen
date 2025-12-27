import type { Dialect, DialectName } from './types';
import { PostgresDialect } from './postgres';
import { MysqlDialect } from './mysql';
import { SqliteDialect } from './sqlite';

export function getDialect(name: DialectName): Dialect {
  switch (name) {
    case 'postgres':
      return new PostgresDialect();
    case 'mysql':
      return new MysqlDialect();
    case 'sqlite':
      return new SqliteDialect();
    default:
      throw new Error(`Unknown dialect: ${name}`);
  }
}

export function detectDialect(connectionString: string): DialectName | null {
  if (
    connectionString === ':memory:' ||
    connectionString.endsWith('.db') ||
    connectionString.endsWith('.sqlite') ||
    connectionString.endsWith('.sqlite3') ||
    connectionString.startsWith('file:')
  ) {
    return 'sqlite';
  }

  try {
    const url = new URL(connectionString);
    const protocol = url.protocol.replace(':', '');

    switch (protocol) {
      case 'postgres':
      case 'postgresql':
        return 'postgres';
      case 'mysql':
      case 'mysql2':
        return 'mysql';
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export { PostgresDialect } from './postgres';
export { MysqlDialect } from './mysql';
export { SqliteDialect } from './sqlite';
export type { Dialect, DialectName, IntrospectOptions, MapTypeOptions } from './types';
