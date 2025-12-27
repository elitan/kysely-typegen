# kysely-gen

Generate TypeScript types from your database for [Kysely](https://kysely.dev/).

Supports PostgreSQL, MySQL, and SQLite.

## Install

```sh
# PostgreSQL
npm install kysely-gen kysely pg

# MySQL
npm install kysely-gen kysely mysql2

# SQLite
npm install kysely-gen kysely better-sqlite3
```

## Usage

```sh
# PostgreSQL (auto-detected from URL)
DATABASE_URL=postgres://user:pass@localhost:5432/db npx kysely-gen

# MySQL (auto-detected from URL)
DATABASE_URL=mysql://user:pass@localhost:3306/db npx kysely-gen

# SQLite (auto-detected from file extension)
npx kysely-gen --url ./database.db

# Explicit dialect
npx kysely-gen --dialect mysql --url mysql://user:pass@localhost:3306/db
```

## Options

| Option | Description |
|--------|-------------|
| `--dialect <name>` | Database dialect: `postgres`, `mysql`, or `sqlite` (auto-detected) |
| `--out <path>` | Output file (default: `./db.d.ts`) |
| `--schema <name>` | Schema to introspect (repeatable) |
| `--url <string>` | Database URL (overrides `DATABASE_URL`) |
| `--camel-case` | Convert names to camelCase |
| `--include-pattern <glob>` | Only include matching tables |
| `--exclude-pattern <glob>` | Exclude matching tables |

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

## License

MIT
