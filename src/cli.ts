#!/usr/bin/env bun
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { Kysely } from 'kysely';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serialize } from '@/ast/serialize';
import { transformDatabase } from '@/transform';
import { getDialect, detectDialect } from '@/dialects';
import type { DialectName } from '@/dialects/types';

const program = new Command();

program
  .name('kysely-gen')
  .description('Generate Kysely types from your database')
  .version('0.1.0')
  .option('-o, --out <path>', 'Output file path', './db.d.ts')
  .option('-s, --schema <name>', 'Schema to introspect (can be specified multiple times)', collect, [])
  .option('--url <connection-string>', 'Database connection string (overrides DATABASE_URL env)')
  .option('-d, --dialect <name>', 'Database dialect (postgres, mysql, sqlite). Auto-detected from URL if not specified')
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
  dialect?: string;
  camelCase?: boolean;
  includePattern: string[];
  excludePattern: string[];
}) {
  const databaseUrl = options.url || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(chalk.red('Error: DATABASE_URL environment variable is required'));
    console.error('');
    console.error('Set it in your environment:');
    console.error(chalk.cyan('  export DATABASE_URL=postgres://user:password@localhost:5432/db'));
    console.error('');
    console.error('Or pass it via --url flag:');
    console.error(chalk.cyan('  kysely-gen --url postgres://user:password@localhost:5432/db'));
    process.exit(1);
  }

  let dialectName: DialectName;
  if (options.dialect) {
    if (options.dialect !== 'postgres' && options.dialect !== 'mysql' && options.dialect !== 'sqlite') {
      console.error(chalk.red(`Error: Unknown dialect '${options.dialect}'. Supported: postgres, mysql, sqlite`));
      process.exit(1);
    }
    dialectName = options.dialect;
  } else {
    const detected = detectDialect(databaseUrl);
    if (!detected) {
      console.error(chalk.red('Error: Could not detect dialect from URL. Use --dialect flag.'));
      process.exit(1);
    }
    dialectName = detected;
  }

  const dialect = getDialect(dialectName);
  const outputPath = options.out;
  const defaultSchema = dialectName === 'sqlite' ? 'main' : 'public';
  const schemas = options.schema.length > 0 ? options.schema : [defaultSchema];

  console.log('');
  console.log(chalk.bold('kysely-gen') + chalk.dim(' v0.1.0'));
  console.log('');
  console.log(chalk.dim('Dialect:'), dialectName);
  console.log(chalk.dim('Connection:'), maskPassword(databaseUrl));
  console.log(chalk.dim('Schemas:'), schemas.join(', '));
  console.log(chalk.dim('Output:'), resolve(outputPath));
  console.log('');

  const spinner = ora('Connecting to database...').start();

  let db: Kysely<any>;
  try {
    const kyselyDialect = await dialect.createKyselyDialect(databaseUrl);
    db = new Kysely({ dialect: kyselyDialect });
    spinner.succeed('Connected to database');
  } catch (error) {
    spinner.fail('Failed to connect to database');
    throw error;
  }

  spinner.start('Introspecting database schema...');
  const metadata = await dialect.introspect(db, { schemas });

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
  const { program: astProgram, warnings } = transformDatabase(metadata, {
    dialectName,
    camelCase: options.camelCase,
    includePattern: options.includePattern.length > 0 ? options.includePattern : undefined,
    excludePattern: options.excludePattern.length > 0 ? options.excludePattern : undefined,
  });
  const code = serialize(astProgram);

  // Write to file
  const absolutePath = resolve(outputPath);
  await writeFile(absolutePath, code, 'utf-8');
  spinner.succeed(`Types written to ${chalk.cyan(absolutePath)}`);

  // Show warnings
  if (warnings.length > 0) {
    console.log('');
    console.log(chalk.yellow('Warnings:'));
    for (const w of warnings) {
      console.log(chalk.dim(`  Unknown type '${w.pgType}' mapped to 'unknown'`));
    }
  }

  // Clean up
  await db.destroy();

  console.log('');
  console.log(chalk.green('Done!'));
  console.log('');
}

function maskPassword(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return connectionString;
  }
}

// Run if called directly
if (import.meta.main) {
  program.parse();
}

export { program };
