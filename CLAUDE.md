# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

kysely-gen is a **PostgreSQL → TypeScript type generator** for Kysely, built with Bun using Test-Driven Development principles. It generates type-safe Kysely database types by introspecting live databases.

**Core Pipeline:** `PostgreSQL → Introspect → Metadata → Transform → AST → Serialize → TypeScript`

## Development Commands

### Testing (Primary Workflow)
```bash
bun test              # Run all tests
bun test --watch      # TDD mode - run continuously
bun test <file>       # Run specific test file
```

### Database
```bash
bun run db:up         # Start PostgreSQL test database (port 5433)
bun run db:down       # Stop test database
bun run db:logs       # View database logs
```

### Running the CLI
```bash
bun run dev           # Run CLI directly (src/cli.ts)
DATABASE_URL=postgres://... bun run dev --out ./output.d.ts
```

## Architecture

### Pipeline Flow

The codebase follows a **layered architecture** with clear separation:

1. **Introspection Layer** (`src/introspect/`)
   - Queries PostgreSQL `information_schema` tables
   - Extracts table, column, and enum metadata
   - Returns structured `DatabaseMetadata` objects

2. **Transform Layer** (`src/transform.ts`)
   - Converts database metadata to AST nodes
   - Maps PostgreSQL types → TypeScript types
   - Handles nullable columns, auto-increment fields, enums
   - Wraps auto-increment columns in `Generated<T>`
   - Creates final `DB` interface with all tables

3. **AST Layer** (`src/ast/`)
   - Type-safe AST nodes represent TypeScript constructs
   - **nodes.ts**: Defines all AST node types (InterfaceNode, TypeNode, etc.)
   - **serialize.ts**: Converts AST → TypeScript code strings

4. **CLI Layer** (`src/cli.ts`)
   - Uses commander for arg parsing, chalk for colors, ora for spinners
   - Orchestrates the full pipeline
   - Handles errors with helpful messages

### Key Design Decisions

**AST-Based Code Generation**: We use a type-safe AST instead of string templates. This ensures:
- Generated TypeScript is always syntactically valid
- Easy to test (test AST nodes, not strings)
- Composable (build complex types from simple nodes)
- Refactor-safe

**@/ Path Alias**: All imports use `@/` instead of relative paths:
```typescript
import { serialize } from '@/ast/serialize';  // ✓ Good
import { serialize } from './ast/serialize';   // ✗ Avoid
```

**Test Co-location**: Tests live in `test/` mirroring `src/` structure:
```
src/ast/nodes.ts       → test/ast/nodes.test.ts
src/transform.ts       → test/transform.test.ts
```

## Adding Features

### Adding New PostgreSQL Types

1. Update `mapPostgresType()` in `src/transform.ts`
2. Add test cases in `test/transform.test.ts`
3. Run `bun test --watch test/transform.test.ts`

### Adding AST Node Types

1. Add node type to `src/ast/nodes.ts`
2. Add serialization logic to `src/ast/serialize.ts`
3. Write tests in `test/ast/` first (TDD!)

Schema defined in: `test/fixtures/init.sql`

## Important Patterns

### TDD Workflow (Critical)

This project uses strict TDD:
1. Write test first (RED)
2. Implement minimal code to pass (GREEN)
3. Refactor (REFACTOR)
4. Use `bun test --watch` continuously

### Type Safety

- All database queries return typed results
- AST nodes are discriminated unions with `kind` field
- Use type narrowing, never type assertions
- Metadata types are defined in `src/introspect/types.ts`

## Key Features

### CamelCase Plugin Support

When using the `--camel-case` flag, column and table names are converted from snake_case to camelCase to work seamlessly with Kysely's `CamelCasePlugin`:

```bash
kysely-gen --camel-case
```

**Conversions:**
- Column names: `created_at` → `createdAt`
- Table names in DB interface: `user_profiles` → `userProfiles`
- Interface names: Stay PascalCase → `UserProfile`

**Implementation:**
- Uses Kysely's built-in `CamelCasePlugin` for consistent conversion logic
- Applied in `transformColumn()` for property names
- Applied in `createDBInterface()` for table properties
- Case converter utility: `src/utils/case-converter.ts`

### ColumnType Support

The codebase now properly generates **`ColumnType<SelectType, InsertType, UpdateType>`** for database types that have different representations during select vs insert/update operations:

- **Timestamps** (`timestamp`, `timestamptz`, `date`):
  - Generated as: `ColumnType<Date, Date | string, Date | string>`
  - Selects return `Date`, but inserts/updates accept `Date` or `string`

- **Bigint** (`int8`, `bigint`):
  - Generated as: `ColumnType<string, string | number | bigint, string | number | bigint>`
  - PostgreSQL returns bigint as string, but accepts number/bigint for insert/update

- **Numeric/Decimal** (`numeric`, `decimal`):
  - Generated as: `ColumnType<string, number | string, number | string>`
  - Returns string but accepts number for insert/update

### Generated<T> Type

Custom `Generated<T>` type helper that properly wraps ColumnType:

```typescript
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
```

This makes auto-increment and default-value columns optional during insert operations while keeping them required during select. The conditional type properly handles both simple types and ColumnType wrappers.

## CLI Options

- `--out <path>` - Output file path (default: `./db.d.ts`)
- `--schema <name>` - Schema to introspect (can specify multiple times)
- `--url <connection-string>` - Database URL (overrides `DATABASE_URL` env)
- `--camel-case` - Convert column/table names to camelCase
- `--include-pattern <pattern>` - Only include matching tables (glob)
- `--exclude-pattern <pattern>` - Exclude matching tables (glob)

## Publishing

Use the GitHub Actions workflow to publish new versions:

```bash
gh workflow run publish.yml -f version=0.4.0
```

Or via GitHub UI: **Actions → Publish to npm → Run workflow**

The workflow will:
- Run tests
- Build package
- Bump version in package.json
- Create git tag
- Push to main
- Publish to npm
- Create GitHub release with auto-generated notes

Do NOT publish manually. Always use the workflow.

## Notes

- `kysely-gen` is a successor of `kysely-codegen`. You do have access to the source code of `kysely-codegen`.
- do not use emojis. ever.