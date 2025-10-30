#!/usr/bin/env bun
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serialize } from '@/ast/serialize';
import { introspectDatabase } from '@/introspect/postgres';
import { transformDatabase } from '@/transform';

const program = new Command();

program
  .name('kysely-typegen')
  .description('Generate Kysely types from your PostgreSQL database')
  .version('0.1.0')
  .option('-o, --out <path>', 'Output file path', './db.d.ts')
  .option('-s, --schema <name>', 'Schema to introspect (can be specified multiple times)', collect, [])
  .option('--url <connection-string>', 'Database connection string (overrides DATABASE_URL env)')
  .option('--camel-case', 'Convert column and table names to camelCase (use with Kysely CamelCasePlugin)')
  .option('--include-pattern <pattern>', 'Only include tables matching glob pattern (schema.table format)', collect, [])
  .option('--exclude-pattern <pattern>', 'Exclude tables matching glob pattern (schema.table format)', collect, [])
  .action(async (options) => {
    try {
      await generate(options);
    } catch (error) {
      console.error('');
      console.error(chalk.red('✗ Error:'), error instanceof Error ? error.message : String(error));

      if (error instanceof Error && error.stack && process.env.DEBUG) {
        console.error('');
        console.error(chalk.dim(error.stack));
      }

      process.exit(1);
    }
  });

function collect(value: string, previous: string[]) {
  return previous.concat([value]);
}

async function generate(options: {
  out: string;
  schema: string[];
  url?: string;
  camelCase?: boolean;
  includePattern: string[];
  excludePattern: string[];
}) {
  // Get DATABASE_URL from options or environment
  const databaseUrl = options.url || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(chalk.red('✗ Error: DATABASE_URL environment variable is required'));
    console.error('');
    console.error('Set it in your environment:');
    console.error(chalk.cyan('  export DATABASE_URL=postgres://user:password@localhost:5432/db'));
    console.error('');
    console.error('Or pass it via --url flag:');
    console.error(chalk.cyan('  kysely-typegen --url postgres://user:password@localhost:5432/db'));
    process.exit(1);
  }

  const outputPath = options.out;
  const schemas = options.schema.length > 0 ? options.schema : ['public'];

  console.log('');
  console.log(chalk.bold('kysely-typegen') + chalk.dim(' v0.1.0'));
  console.log('');
  console.log(chalk.dim('Connection:'), maskPassword(databaseUrl));
  console.log(chalk.dim('Schemas:'), schemas.join(', '));
  console.log(chalk.dim('Output:'), resolve(outputPath));
  console.log('');

  // Connect and introspect
  const spinner = ora('Connecting to database...').start();

  let db: Kysely<any>;
  try {
    const pool = new Pool({ connectionString: databaseUrl });
    db = new Kysely({ dialect: new PostgresDialect({ pool }) });
    spinner.succeed('Connected to database');
  } catch (error) {
    spinner.fail('Failed to connect to database');
    throw error;
  }

  // Introspect
  spinner.start('Introspecting database schema...');
  const metadata = await introspectDatabase(db, { schemas });

  const tableCount = metadata.tables.length;
  const enumCount = metadata.enums.length;

  if (tableCount === 0 && enumCount === 0) {
    spinner.warn('No tables or enums found');
    console.log('');
    console.log(chalk.yellow('⚠ Warning: No tables or enums found in the specified schemas.'));
    console.log(chalk.dim('  Make sure the schema names are correct and contain tables.'));
    await db.destroy();
    return;
  }

  spinner.succeed(`Found ${chalk.bold(tableCount)} tables and ${chalk.bold(enumCount)} enums`);

  // Transform and generate
  spinner.start('Generating TypeScript types...');
  const program = transformDatabase(metadata, {
    camelCase: options.camelCase,
    includePattern: options.includePattern.length > 0 ? options.includePattern : undefined,
    excludePattern: options.excludePattern.length > 0 ? options.excludePattern : undefined,
  });
  const code = serialize(program);

  // Write to file
  const absolutePath = resolve(outputPath);
  await writeFile(absolutePath, code, 'utf-8');
  spinner.succeed(`Types written to ${chalk.cyan(absolutePath)}`);

  // Clean up
  await db.destroy();

  console.log('');
  console.log(chalk.green('✓ Done!'));
  console.log('');
}

function maskPassword(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

// Run if called directly
if (import.meta.main) {
  program.parse();
}

export { program };
