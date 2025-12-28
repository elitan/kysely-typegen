#!/usr/bin/env bun
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { Kysely } from 'kysely';
import { readFile, writeFile } from 'node:fs/promises';
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
  .option('--print', 'Output to stdout instead of writing to file')
  .option('--verify', 'Verify types match existing file (exit 1 if different)')
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
  print?: boolean;
  verify?: boolean;
}) {
  const printMode = options.print === true;
  const log = printMode
    ? (...args: unknown[]) => console.error(...args)
    : (...args: unknown[]) => console.log(...args);

  if (options.verify && options.print) {
    console.error(chalk.red('Error: Cannot use --verify with --print'));
    process.exit(1);
  }

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
    if (options.dialect !== 'postgres' && options.dialect !== 'mysql' && options.dialect !== 'sqlite' && options.dialect !== 'mssql') {
      console.error(chalk.red(`Error: Unknown dialect '${options.dialect}'. Supported: postgres, mysql, sqlite, mssql`));
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
  const defaultSchema = dialectName === 'sqlite' ? 'main' : dialectName === 'mssql' ? 'dbo' : 'public';
  const schemas = options.schema.length > 0 ? options.schema : [defaultSchema];

  log('');
  log(chalk.bold('kysely-gen') + chalk.dim(' v0.1.0'));
  log('');
  log(chalk.dim('Dialect:'), dialectName);
  log(chalk.dim('Connection:'), maskPassword(databaseUrl));
  log(chalk.dim('Schemas:'), schemas.join(', '));
  if (!printMode) {
    log(chalk.dim('Output:'), resolve(outputPath));
  }
  log('');

  const spinner = ora({ text: 'Connecting to database...', stream: printMode ? process.stderr : process.stdout }).start();

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
    log('');
    log(chalk.yellow('Warning: No tables or enums found in the specified schemas.'));
    log(chalk.dim('  Make sure the schema names are correct and contain tables.'));
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

  if (options.verify) {
    const absolutePath = resolve(outputPath);
    const existing = await readFile(absolutePath, 'utf-8').catch(() => null);

    if (existing === null) {
      spinner.fail(`File not found: ${chalk.cyan(absolutePath)}`);
      await db.destroy();
      process.exit(1);
    }

    if (existing === code) {
      spinner.succeed('Types are up-to-date');
      await db.destroy();
      process.exit(0);
    }

    spinner.fail('Types are out of date');
    log('');
    log(chalk.yellow('Generated types differ from existing file.'));
    log(chalk.dim('Run kysely-gen to update.'));
    await db.destroy();
    process.exit(1);
  }

  if (printMode) {
    spinner.succeed('Types generated');
    process.stdout.write(code);
  } else {
    const absolutePath = resolve(outputPath);
    await writeFile(absolutePath, code, 'utf-8');
    spinner.succeed(`Types written to ${chalk.cyan(absolutePath)}`);
  }

  // Show warnings
  if (warnings.length > 0) {
    log('');
    log(chalk.yellow('Warnings:'));
    for (const w of warnings) {
      log(chalk.dim(`  Unknown type '${w.pgType}' mapped to 'unknown'`));
    }
  }

  // Clean up
  await db.destroy();

  if (!printMode) {
    log('');
    log(chalk.green('Done!'));
    log('');
  }
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
