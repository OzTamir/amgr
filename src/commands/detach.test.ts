import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { detach } from './detach.js';
import { writeLockFile } from '../lib/lock.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestFile,
  createTestProject,
  createTestConfig,
} from '../test-utils.js';

vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn(),
}));

import { confirm } from '@inquirer/prompts';

describe('detach command', () => {
  let tempDir: string;
  let originalCwd: string;
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    tempDir = createTempDir();
    originalCwd = process.cwd();
    process.chdir(tempDir);

    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanupTempDir(tempDir);
    vi.restoreAllMocks();
  });

  it('shows message when no .amgr directory exists', async () => {
    await detach();

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('No .amgr directory found')
    );
  });

  it('removes tracked files', async () => {
    createTestFile(join(tempDir, '.claude', 'file.txt'), 'content');
    mkdirSync(join(tempDir, '.amgr'), { recursive: true });
    writeLockFile(tempDir, ['.claude/file.txt']);

    vi.mocked(confirm).mockResolvedValue(true);

    await detach();

    expect(existsSync(join(tempDir, '.claude', 'file.txt'))).toBe(false);
    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Removed 1 files'));
  });

  it('shows what would be removed in dry-run mode', async () => {
    createTestFile(join(tempDir, '.claude', 'file.txt'), 'content');
    createTestProject(tempDir, createTestConfig());
    writeLockFile(tempDir, ['.claude/file.txt']);

    await detach({ dryRun: true });

    expect(existsSync(join(tempDir, '.claude', 'file.txt'))).toBe(true);
    expect(existsSync(join(tempDir, '.amgr', 'config.json'))).toBe(true);
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('dry-run')
    );
  });

  it('removes .amgr directory when user confirms', async () => {
    createTestProject(tempDir, createTestConfig());

    vi.mocked(confirm).mockResolvedValue(true);

    await detach();

    expect(existsSync(join(tempDir, '.amgr'))).toBe(false);
    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Removed .amgr/ directory'));
  });

  it('preserves .amgr directory when user declines', async () => {
    createTestProject(tempDir, createTestConfig());

    vi.mocked(confirm).mockResolvedValue(false);

    await detach();

    expect(existsSync(join(tempDir, '.amgr', 'config.json'))).toBe(true);
    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Preserved'));
  });
});
