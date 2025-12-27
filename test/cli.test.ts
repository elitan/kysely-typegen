import { describe, expect, test } from 'bun:test';
import { spawn } from 'bun';
import { resolve } from 'node:path';
import { unlink } from 'node:fs/promises';

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
      expect(stdout).toContain('export interface User {');
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
});
