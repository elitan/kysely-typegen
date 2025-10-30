# kysely-typegen

Modern Kysely type generator built with Bun and TDD principles.

## Features

- ✅ **Solid foundations** - AST-based code generation
- ✅ **Type-safe** - Full TypeScript types throughout
- ✅ **Well-tested** - 64 tests with TDD approach
- ✅ **Fast** - Built with Bun
- ✅ **ColumnType support** - Proper types for select/insert/update operations
- ✅ **CamelCase plugin** - Optional camelCase conversion
- ✅ **PostgreSQL enums** - Properly maps enum columns to enum types
- ✅ **Table filtering** - Include/exclude tables with glob patterns
- ✅ **PostgreSQL support** - More dialects coming soon

## Installation

```sh
bun install kysely-typegen kysely pg
```

## Usage

### Basic usage

```sh
DATABASE_URL=postgres://user:password@localhost:5432/db kysely-typegen
```

### Specify output file

```sh
DATABASE_URL=postgres://localhost/db kysely-typegen --out ./src/db.d.ts
```

### Multiple schemas

```sh
DATABASE_URL=postgres://localhost/db kysely-typegen --schema public --schema auth
```

### CamelCase plugin support

Generate camelCase column and table names (for use with Kysely's CamelCasePlugin):

```sh
kysely-typegen --camel-case
```

This converts:
- Column names: `created_at` → `createdAt`
- Table names in DB interface: `user_profiles` → `userProfiles`
- Interface names stay PascalCase: `UserProfile`

### Filter tables

Only include specific tables:

```sh
kysely-typegen --include-pattern="public.user*"
kysely-typegen --include-pattern="public.users" --include-pattern="auth.*"
```

Exclude tables matching a pattern:

```sh
kysely-typegen --exclude-pattern="*_internal"
kysely-typegen --exclude-pattern="*.migrations"
```

Combine include and exclude:

```sh
kysely-typegen --include-pattern="public.*" --exclude-pattern="*_backup"
```

Pattern format is `schema.table` and supports glob syntax (`*`, `?`, `+(...)`, etc.).

## Example Output

```typescript
import type { ColumnType } from 'kysely';

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

// PostgreSQL enums are mapped to TypeScript union types
export type StatusEnum = 'pending' | 'approved' | 'rejected';

export interface User {
  id: Generated<number>;
  email: string;
  // Timestamps use ColumnType for flexible insert/update
  created_at: ColumnType<Date, Date | string, Date | string>;
  updated_at: ColumnType<Date, Date | string, Date | string> | null;
  is_active: boolean;
}

export interface Comment {
  id: Generated<number>;
  user_id: number;
  content: string;
  status: StatusEnum;  // ← Enum columns properly typed
  created_at: ColumnType<Date, Date | string, Date | string>;
}

export interface DB {
  users: User;
  comments: Comment;
}
```

### With --camel-case

```typescript
export interface User {
  id: Generated<number>;
  email: string;
  createdAt: ColumnType<Date, Date | string, Date | string>;  // ← camelCase!
  updatedAt: ColumnType<Date, Date | string, Date | string> | null;
  isActive: boolean;
}

export interface DB {
  users: User;  // ← camelCase table names
  comments: Comment;
}
```

## Development

### Setup

```sh
bun install
bun run db:up  # Start test database
```

### Testing

```sh
bun test              # Run all tests
bun test --watch      # Watch mode (TDD)
bun run db:logs       # View database logs
```

### Architecture

```
Database → Metadata → AST → TypeScript
```

- **Introspect** - Query `information_schema` for metadata
- **Transform** - Convert metadata to type-safe AST nodes
- **Serialize** - Generate clean TypeScript code

## Project Structure

```
src/
├── ast/
│   ├── nodes.ts          # AST node types
│   └── serialize.ts      # AST → TypeScript serializer
├── introspect/
│   ├── types.ts          # Metadata types
│   └── postgres.ts       # PostgreSQL introspector
├── transform.ts          # Metadata → AST transformation
├── cli.ts               # CLI with commander + chalk + ora
└── index.ts             # Public API

test/
├── ast/
│   ├── nodes.test.ts
│   └── serialize.test.ts
├── introspect/
│   └── postgres.test.ts
├── transform.test.ts
└── integration.test.ts
```

### Key Features

- **@/ Path Alias** - Clean imports without relative path hell
- **Professional CLI** - Built with commander, chalk, and ora
- **Test-Driven** - 64 tests, all passing
- **Type-Safe** - Full TypeScript throughout
- **ColumnType Support** - Proper types for select/insert/update differences
- **CamelCase Plugin** - Optional camelCase conversion
- **Enum Support** - PostgreSQL enums map to TypeScript types
- **Table Filtering** - Powerful glob-based filtering with micromatch
