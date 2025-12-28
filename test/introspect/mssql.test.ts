import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Kysely, MssqlDialect } from 'kysely';
import { introspectMssql } from '@/dialects/mssql/introspect';

const SKIP_MSSQL_TESTS = !process.env.TEST_MSSQL;

describe.skipIf(SKIP_MSSQL_TESTS)('MSSQL Introspector', () => {
  let db: Kysely<any>;

  beforeAll(async () => {
    const tarn = await import('tarn');
    const tedious = await import('tedious');

    db = new Kysely({
      dialect: new MssqlDialect({
        tarn: {
          ...tarn,
          options: { min: 0, max: 1 },
        },
        tedious: {
          ...tedious,
          connectionFactory: () => {
            return new tedious.Connection({
              authentication: {
                options: { password: 'Test_Password123', userName: 'sa' },
                type: 'default',
              },
              options: {
                database: 'test_db',
                encrypt: true,
                port: 1434,
                trustServerCertificate: true,
              },
              server: 'localhost',
            });
          },
        },
      }),
    });
  });

  afterAll(async () => {
    await db.destroy();
  });

  test('should introspect tables from database', async () => {
    const metadata = await introspectMssql(db, { schemas: ['dbo'] });

    expect(metadata.tables.length).toBeGreaterThan(0);

    const users = metadata.tables.find((t) => t.name === 'users');
    expect(users).toBeDefined();
    expect(users?.schema).toBe('dbo');
  });

  test('should introspect columns with correct types', async () => {
    const metadata = await introspectMssql(db, { schemas: ['dbo'] });

    const users = metadata.tables.find((t) => t.name === 'users');
    expect(users).toBeDefined();

    const idColumn = users?.columns.find((c) => c.name === 'id');
    expect(idColumn).toBeDefined();
    expect(idColumn?.dataType).toBe('int');
    expect(idColumn?.isNullable).toBe(false);
    expect(idColumn?.isAutoIncrement).toBe(true);

    const emailColumn = users?.columns.find((c) => c.name === 'email');
    expect(emailColumn).toBeDefined();
    expect(emailColumn?.dataType).toBe('nvarchar');
    expect(emailColumn?.isNullable).toBe(false);
  });

  test('should identify nullable columns', async () => {
    const metadata = await introspectMssql(db, { schemas: ['dbo'] });

    const users = metadata.tables.find((t) => t.name === 'users');
    const updatedAtColumn = users?.columns.find((c) => c.name === 'updated_at');

    expect(updatedAtColumn).toBeDefined();
    expect(updatedAtColumn?.isNullable).toBe(true);
  });

  test('should identify identity columns', async () => {
    const metadata = await introspectMssql(db, { schemas: ['dbo'] });

    const users = metadata.tables.find((t) => t.name === 'users');
    const idColumn = users?.columns.find((c) => c.name === 'id');

    expect(idColumn?.isAutoIncrement).toBe(true);
    expect(idColumn?.hasDefaultValue).toBe(true);
  });

  test('should introspect bit columns as bit type', async () => {
    const metadata = await introspectMssql(db, { schemas: ['dbo'] });

    const users = metadata.tables.find((t) => t.name === 'users');
    const isActiveColumn = users?.columns.find((c) => c.name === 'is_active');

    expect(isActiveColumn).toBeDefined();
    expect(isActiveColumn?.dataType).toBe('bit');
  });

  test('should introspect binary columns', async () => {
    const metadata = await introspectMssql(db, { schemas: ['dbo'] });

    const files = metadata.tables.find((t) => t.name === 'files');
    expect(files).toBeDefined();

    const contentColumn = files?.columns.find((c) => c.name === 'content');
    expect(contentColumn?.dataType).toBe('varbinary');

    const checksumColumn = files?.columns.find((c) => c.name === 'checksum');
    expect(checksumColumn?.dataType).toBe('binary');
  });

  test('should introspect uniqueidentifier columns', async () => {
    const metadata = await introspectMssql(db, { schemas: ['dbo'] });

    const files = metadata.tables.find((t) => t.name === 'files');
    const guidColumn = files?.columns.find((c) => c.name === 'guid');

    expect(guidColumn).toBeDefined();
    expect(guidColumn?.dataType).toBe('uniqueidentifier');
  });

  test('should introspect various numeric types', async () => {
    const metadata = await introspectMssql(db, { schemas: ['dbo'] });

    const metrics = metadata.tables.find((t) => t.name === 'metrics');
    expect(metrics).toBeDefined();

    const tinyValColumn = metrics?.columns.find((c) => c.name === 'tiny_val');
    expect(tinyValColumn?.dataType).toBe('tinyint');

    const bigValColumn = metrics?.columns.find((c) => c.name === 'big_val');
    expect(bigValColumn?.dataType).toBe('bigint');

    const moneyValColumn = metrics?.columns.find((c) => c.name === 'money_val');
    expect(moneyValColumn?.dataType).toBe('money');

    const decimalValColumn = metrics?.columns.find((c) => c.name === 'decimal_val');
    expect(decimalValColumn?.dataType).toBe('decimal');
  });

  test('should introspect date/time columns', async () => {
    const metadata = await introspectMssql(db, { schemas: ['dbo'] });

    const events = metadata.tables.find((t) => t.name === 'events');
    expect(events).toBeDefined();

    const dateColumn = events?.columns.find((c) => c.name === 'event_date');
    expect(dateColumn?.dataType).toBe('date');

    const datetime2Column = events?.columns.find((c) => c.name === 'event_datetime2');
    expect(datetime2Column?.dataType).toBe('datetime2');

    const datetimeoffsetColumn = events?.columns.find((c) => c.name === 'event_datetimeoffset');
    expect(datetimeoffsetColumn?.dataType).toBe('datetimeoffset');
  });

  test('should introspect special types', async () => {
    const metadata = await introspectMssql(db, { schemas: ['dbo'] });

    const specialTypes = metadata.tables.find((t) => t.name === 'special_types');
    expect(specialTypes).toBeDefined();

    const xmlColumn = specialTypes?.columns.find((c) => c.name === 'xml_data');
    expect(xmlColumn?.dataType).toBe('xml');

    const variantColumn = specialTypes?.columns.find((c) => c.name === 'variant_data');
    expect(variantColumn?.dataType).toBe('sql_variant');
  });

  test('should introspect views', async () => {
    const metadata = await introspectMssql(db, { schemas: ['dbo'] });

    const activeUsers = metadata.tables.find((t) => t.name === 'active_users');
    expect(activeUsers).toBeDefined();
    expect(activeUsers?.isView).toBe(true);
    expect(activeUsers?.schema).toBe('dbo');

    const columns = activeUsers?.columns ?? [];
    expect(columns.length).toBe(4);

    const idColumn = columns.find((c) => c.name === 'id');
    expect(idColumn).toBeDefined();
    expect(idColumn?.dataType).toBe('int');
    expect(idColumn?.isAutoIncrement).toBe(false);
  });

  test('should introspect multiple schemas', async () => {
    const metadata = await introspectMssql(db, { schemas: ['dbo', 'test_schema'] });

    const tableSchemas = metadata.tables.map((t) => t.schema);
    expect(tableSchemas).toContain('dbo');
    expect(tableSchemas).toContain('test_schema');

    const tasksTable = metadata.tables.find(
      (t) => t.schema === 'test_schema' && t.name === 'tasks'
    );
    expect(tasksTable).toBeDefined();
    expect(tasksTable?.columns.length).toBeGreaterThan(0);
  });

  test('should introspect views from different schemas', async () => {
    const metadata = await introspectMssql(db, { schemas: ['dbo', 'test_schema'] });

    const activeTasksView = metadata.tables.find(
      (t) => t.schema === 'test_schema' && t.name === 'active_tasks'
    );
    expect(activeTasksView).toBeDefined();
    expect(activeTasksView?.isView).toBe(true);
  });

  test('should return empty enums (MSSQL has no native enum)', async () => {
    const metadata = await introspectMssql(db, { schemas: ['dbo'] });
    expect(metadata.enums).toEqual([]);
  });

  test('should detect columns with default values', async () => {
    const metadata = await introspectMssql(db, { schemas: ['dbo'] });

    const users = metadata.tables.find((t) => t.name === 'users');
    const createdAtColumn = users?.columns.find((c) => c.name === 'created_at');

    expect(createdAtColumn?.hasDefaultValue).toBe(true);
  });

  test('should detect computed columns as auto-increment (Generated)', async () => {
    const metadata = await introspectMssql(db, { schemas: ['dbo'] });

    const orders = metadata.tables.find((t) => t.name === 'orders');
    expect(orders).toBeDefined();

    const totalPriceColumn = orders?.columns.find((c) => c.name === 'total_price');
    expect(totalPriceColumn).toBeDefined();
    expect(totalPriceColumn?.isAutoIncrement).toBe(true);
    expect(totalPriceColumn?.hasDefaultValue).toBe(true);
  });
});
