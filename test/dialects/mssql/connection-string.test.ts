import { describe, expect, test } from 'bun:test';
import { MssqlDialect } from '@/dialects/mssql';

describe('MSSQL Connection String Parsing', () => {
  const dialect = new MssqlDialect();

  describe('URL format', () => {
    test('should parse basic mssql:// URL', async () => {
      const config = await (dialect as any).parseConnectionString(
        'mssql://user:pass@localhost:1433/mydb'
      );

      expect(config.server).toBe('localhost');
      expect(config.port).toBe(1433);
      expect(config.database).toBe('mydb');
      expect(config.userName).toBe('user');
      expect(config.password).toBe('pass');
      expect(config.instanceName).toBeUndefined();
    });

    test('should parse sqlserver:// URL', async () => {
      const config = await (dialect as any).parseConnectionString(
        'sqlserver://admin:secret@dbserver:1434/production'
      );

      expect(config.server).toBe('dbserver');
      expect(config.port).toBe(1434);
      expect(config.database).toBe('production');
      expect(config.userName).toBe('admin');
      expect(config.password).toBe('secret');
    });

    test('should use default port 1433 when not specified', async () => {
      const config = await (dialect as any).parseConnectionString(
        'mssql://user:pass@localhost/mydb'
      );

      expect(config.port).toBe(1433);
    });

    test('should decode URL-encoded credentials', async () => {
      const config = await (dialect as any).parseConnectionString(
        'mssql://user%40domain:p%40ss%2Fword@localhost/mydb'
      );

      expect(config.userName).toBe('user@domain');
      expect(config.password).toBe('p@ss/word');
    });
  });

  describe('ADO.NET format', () => {
    test('should parse basic ADO.NET connection string', async () => {
      const config = await (dialect as any).parseConnectionString(
        'Server=localhost;Database=mydb;User Id=user;Password=pass;'
      );

      expect(config.server).toBe('localhost');
      expect(config.database).toBe('mydb');
      expect(config.userName).toBe('user');
      expect(config.password).toBe('pass');
    });

    test('should parse connection string with port in Server', async () => {
      const config = await (dialect as any).parseConnectionString(
        'Server=localhost,1434;Database=mydb;User Id=user;Password=pass;'
      );

      expect(config.server).toBe('localhost');
      expect(config.port).toBe(1434);
    });

    test('should parse connection string with instance name', async () => {
      const config = await (dialect as any).parseConnectionString(
        'Server=localhost\\SQLEXPRESS;Database=mydb;User Id=user;Password=pass;'
      );

      expect(config.server).toBe('localhost');
      expect(config.instanceName).toBe('SQLEXPRESS');
      expect(config.port).toBeUndefined();
    });

    test('should parse Data Source alias', async () => {
      const config = await (dialect as any).parseConnectionString(
        'Data Source=dbserver;Database=mydb;User Id=user;Password=pass;'
      );

      expect(config.server).toBe('dbserver');
    });

    test('should parse Initial Catalog alias', async () => {
      const config = await (dialect as any).parseConnectionString(
        'Server=localhost;Initial Catalog=mydb;User Id=user;Password=pass;'
      );

      expect(config.database).toBe('mydb');
    });
  });
});
