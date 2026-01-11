# kysely-gen

Generate TypeScript types from your database for [Kysely](https://kysely.dev/).

Supports PostgreSQL, MySQL, SQLite, and MSSQL.

## Install

```sh
# PostgreSQL
npm install kysely-gen kysely pg

# MySQL
npm install kysely-gen kysely mysql2

# SQLite
npm install kysely-gen kysely better-sqlite3

# MSSQL
npm install kysely-gen kysely tedious tarn
```

## Usage

```sh
# PostgreSQL (auto-detected from URL)
DATABASE_URL=postgres://user:pass@localhost:5432/db npx kysely-gen

# MySQL (auto-detected from URL)
DATABASE_URL=mysql://user:pass@localhost:3306/db npx kysely-gen

# SQLite (auto-detected from file extension)
npx kysely-gen --url ./database.db

# MSSQL (auto-detected from URL or connection string)
npx kysely-gen --url "mssql://user:pass@localhost:1433/db"
npx kysely-gen --url "Server=localhost;Database=db;User Id=user;Password=pass"

# Explicit dialect
npx kysely-gen --dialect mysql --url mysql://user:pass@localhost:3306/db
```

## Options

| Option | Description |
|--------|-------------|
| `--dialect <name>` | Database dialect: `postgres`, `mysql`, `sqlite`, or `mssql` (auto-detected) |
| `--out <path>` | Output file (default: `./db.d.ts`) |
| `--schema <name>` | Schema to introspect (repeatable) |
| `--url <string>` | Database URL (overrides `DATABASE_URL`) |
| `--camel-case` | Convert names to camelCase |
| `--include-pattern <glob>` | Only include matching tables |
| `--exclude-pattern <glob>` | Exclude matching tables |
| `--zod` | Generate Zod schemas instead of TypeScript interfaces |

## Zod Schema Generation

Generate Zod validation schemas with inferred types instead of TypeScript interfaces. Requires Zod v4+:

```sh
npm install zod@4
npx kysely-gen --zod
```

This generates `db-schemas.ts` with Zod schemas and inferred types:

```typescript
import { z } from 'zod';

export const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string().nullable(),
  createdAt: z.date(),
});

export const newUserSchema = z.object({
  id: z.number().optional(),
  email: z.string(),
  name: z.string().nullable().optional(),
  createdAt: z.union([z.date(), z.string()]).optional(),
});

export const userUpdateSchema = z.object({
  id: z.number().optional(),
  email: z.string().optional(),
  name: z.string().nullable().optional(),
  createdAt: z.union([z.date(), z.string()]).optional(),
});

export type User = z.infer<typeof userSchema>;
export type NewUser = z.infer<typeof newUserSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
```

Three schemas are generated per table:
- **Select schema** (`userSchema`): What you get from queries
- **Insert schema** (`newUserSchema`): For inserts - auto-increment/default columns are optional
- **Update schema** (`userUpdateSchema`): For updates - all columns are optional

The `--zod` flag replaces TypeScript interface generation. Types are inferred from schemas via `z.infer<>`, ensuring they never drift.

## Example

```sh
kysely-gen --out ./src/db.d.ts --camel-case
```

Generates:

```typescript
import type { ColumnType } from 'kysely';

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Status = 'pending' | 'approved' | 'rejected';

export interface User {
  id: Generated<number>;
  email: string;
  status: Status;
  createdAt: ColumnType<Date, Date | string, Date | string>;
}

export interface DB {
  users: User;
}
```

## Features

### PostgreSQL
- Enums mapped to union types
- `ColumnType` for select/insert/update type differences
- `Generated<T>` for auto-increment and default columns
- Materialized views, domains, partitioned tables
- Array columns

### MySQL
- Enums parsed from column definitions
- `ColumnType` for timestamps, bigint, decimal
- `Generated<T>` for auto_increment columns
- Views
- Geometry types (Point, LineString, Polygon)
- `tinyint(1)` mapped to boolean

### SQLite
- `Generated<T>` for INTEGER PRIMARY KEY (auto-increment)
- Views
- JSON columns mapped to `JsonValue`
- Simple type affinity mapping (no ColumnType wrappers)

### MSSQL
- `Generated<T>` for identity and computed columns
- Views
- Multi-schema support (default: `dbo`)
- All MSSQL types: `uniqueidentifier`, `datetime2`, `datetimeoffset`, `money`, `xml`, `varbinary`, etc.
- Both URL (`mssql://`) and ADO.NET connection string formats

## Type Mappings

Types are generated to match the default behavior of each database driver. If you customize your driver's type parsers, the generated types may not match.

### PostgreSQL

Generated types match `node-postgres` (pg) defaults:

- **Dates** (`timestamp`, `date`): Driver returns `Date` objects. Inserts accept `Date | string`.
- **Bigint** (`int8`): Driver returns `string` (JS Number can't represent full int8 range). Inserts accept `string | number | bigint`.
- **Numeric** (`numeric`, `decimal`): Driver returns `string` for precision. Inserts accept `string | number`.

| PostgreSQL | TypeScript |
|------------|------------|
| `int2`, `int4`, `integer` | `number` |
| `int8`, `bigint` | `ColumnType<string, string \| number \| bigint, ...>` |
| `numeric`, `decimal` | `ColumnType<string, number \| string, ...>` |
| `timestamp`, `date` | `ColumnType<Date, Date \| string, ...>` |
| `jsonb`, `json` | `JsonValue` |
| `text[]`, `int4[]` | `string[]`, `number[]` |

### MySQL

Generated types match `mysql2` defaults:

- **Dates** (`datetime`, `timestamp`): Driver returns `Date` objects. Inserts accept `Date | string`.
- **Bigint**: Driver returns `string`. Inserts accept `string | number | bigint`.
- **Decimal**: Driver returns `string` for precision. Inserts accept `string | number`.

| MySQL | TypeScript |
|-------|------------|
| `tinyint(1)` | `boolean` |
| `int`, `smallint` | `number` |
| `bigint` | `ColumnType<string, string \| number \| bigint, ...>` |
| `decimal` | `ColumnType<string, number \| string, ...>` |
| `datetime`, `timestamp` | `ColumnType<Date, Date \| string, ...>` |
| `json` | `JsonValue` |
| `point` | `Point` |
| `enum('a','b')` | `'a' \| 'b'` |

### SQLite

Generated types match `better-sqlite3` defaults. SQLite has simpler type affinity - no `ColumnType` wrappers needed since values are returned as-is.

| SQLite | TypeScript |
|--------|------------|
| `INTEGER`, `INT`, `BIGINT` | `number` |
| `REAL`, `DOUBLE`, `FLOAT` | `number` |
| `TEXT`, `VARCHAR`, `CHAR` | `string` |
| `BLOB` | `Buffer` |
| `DATE`, `DATETIME`, `TIMESTAMP` | `string` |
| `JSON` | `JsonValue` |
| `BOOLEAN` | `number` (0/1) |

### MSSQL

Generated types match `tedious` defaults. The driver handles type conversions, so simple types are used without `ColumnType` wrappers.

| MSSQL | TypeScript |
|-------|------------|
| `int`, `smallint`, `tinyint`, `bigint` | `number` |
| `decimal`, `numeric`, `money`, `smallmoney` | `number` |
| `float`, `real` | `number` |
| `datetime`, `datetime2`, `date`, `time` | `Date` |
| `datetimeoffset`, `smalldatetime` | `Date` |
| `char`, `varchar`, `nchar`, `nvarchar` | `string` |
| `text`, `ntext` | `string` |
| `uniqueidentifier` | `string` |
| `xml` | `string` |
| `bit` | `boolean` |
| `binary`, `varbinary`, `image` | `Buffer` |
| `sql_variant` | `unknown` |

## License

MIT
