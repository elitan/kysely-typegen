import { describe, expect, test } from 'bun:test';
import { spawn } from 'bun';
import { resolve } from 'node:path';
import { unlink, writeFile } from 'node:fs/promises';

const TEST_DATABASE_URL = 'postgres://test_user:test_password@localhost:5433/test_db';
const CLI_PATH = resolve(import.meta.dir, '../src/cli.ts');

describe('CLI', () => {
  describe('--print flag', () => {
    test('should output TypeScript code to stdout', async () => {
      const proc = spawn({
        cmd: ['bun', CLI_PATH, '--print'],
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      expect(stdout).toContain("import type { ColumnType } from 'kysely'");
      expect(stdout).toContain('export type Generated<T>');
      expect(stdout).toContain('export interface Users {');
      expect(stdout).toContain('export interface DB {');
    });

    test('should send progress messages to stderr', async () => {
      const proc = spawn({
        cmd: ['bun', CLI_PATH, '--print'],
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      expect(stderr).toContain('kysely-gen');
      expect(stderr).toContain('Connected to database');
      expect(stderr).toContain('Types generated');
    });

    test('should not include output path in progress when --print is set', async () => {
      const proc = spawn({
        cmd: ['bun', CLI_PATH, '--print'],
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      expect(stderr).not.toContain('Output:');
    });

    test('should ignore --out when --print is set', async () => {
      const testOutputPath = '/tmp/test-should-not-exist.d.ts';

      try {
        await unlink(testOutputPath);
      } catch {
        // file doesn't exist, that's fine
      }

      const proc = spawn({
        cmd: ['bun', CLI_PATH, '--print', '--out', testOutputPath],
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      await proc.exited;

      const fileExists = await Bun.file(testOutputPath).exists();
      expect(fileExists).toBe(false);
    });
  });

  describe('--verify flag', () => {
    test('should exit 0 when types match', async () => {
      const testOutputPath = '/tmp/test-verify-match.d.ts';

      const genProc = spawn({
        cmd: ['bun', CLI_PATH, '--print'],
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const generatedCode = await new Response(genProc.stdout).text();
      await genProc.exited;

      await writeFile(testOutputPath, generatedCode);

      const verifyProc = spawn({
        cmd: ['bun', CLI_PATH, '--verify', '--out', testOutputPath],
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const exitCode = await verifyProc.exited;
      const stdout = await new Response(verifyProc.stdout).text();

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Types are up-to-date');

      await unlink(testOutputPath);
    });

    test('should exit 1 when types differ', async () => {
      const testOutputPath = '/tmp/test-verify-differ.d.ts';
      await writeFile(testOutputPath, 'outdated content');

      const proc = spawn({
        cmd: ['bun', CLI_PATH, '--verify', '--out', testOutputPath],
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();

      expect(exitCode).toBe(1);
      expect(stdout).toContain('Types are out of date');

      await unlink(testOutputPath);
    });

    test('should exit 1 when file does not exist', async () => {
      const testOutputPath = '/tmp/test-verify-nonexistent.d.ts';

      try {
        await unlink(testOutputPath);
      } catch {
        // file doesn't exist, that's fine
      }

      const proc = spawn({
        cmd: ['bun', CLI_PATH, '--verify', '--out', testOutputPath],
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();

      expect(exitCode).toBe(1);
      expect(stdout).toContain('File not found');
    });

    test('should error when used with --print', async () => {
      const proc = spawn({
        cmd: ['bun', CLI_PATH, '--verify', '--print'],
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Cannot use --verify with --print');
    });
  });

  describe('--zod flag', () => {
    test('should output Zod schemas to stdout with --print', async () => {
      const proc = spawn({
        cmd: ['bun', CLI_PATH, '--zod', '--print'],
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      expect(stdout).toContain("import { z } from 'zod';");
      expect(stdout).toContain('export const usersSchema = z.object({');
      expect(stdout).toContain('export const newUsersSchema = z.object({');
      expect(stdout).toContain('export type Users = z.infer<typeof usersSchema>;');
    });

    test('should show Zod schemas generated message', async () => {
      const proc = spawn({
        cmd: ['bun', CLI_PATH, '--zod', '--print'],
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      expect(stderr).toContain('Zod schemas generated');
    });

    test('should write to db-schemas.ts by default', async () => {
      const testOutputPath = '/tmp/db-schemas.ts';

      try {
        await unlink(testOutputPath);
      } catch {
        // file doesn't exist
      }

      const proc = spawn({
        cmd: ['bun', CLI_PATH, '--zod', '--out', testOutputPath],
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      await proc.exited;

      const fileExists = await Bun.file(testOutputPath).exists();
      expect(fileExists).toBe(true);

      const content = await Bun.file(testOutputPath).text();
      expect(content).toContain("import { z } from 'zod';");
      expect(content).toContain('export const usersSchema = z.object({');

      await unlink(testOutputPath);
    });

    test('should support --camel-case with --zod', async () => {
      const proc = spawn({
        cmd: ['bun', CLI_PATH, '--zod', '--camel-case', '--print'],
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      expect(stdout).toContain('createdAt:');
      expect(stdout).not.toContain('created_at:');
    });
  });
});
