import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { clean } from './clean.js';
import { writeLockFile, getTrackedFiles } from '../lib/lock.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestFile,
} from '../test-utils.js';

describe('clean command', () => {
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

  it('shows message when no lock file exists', async () => {
    await clean();

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('No amgr lock file found')
    );
  });

  it('shows message when no tracked files', async () => {
    writeLockFile(tempDir, []);

    await clean();

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('No tracked files found')
    );
  });

  it('removes tracked files', async () => {
    createTestFile(join(tempDir, '.claude', 'file.txt'), 'content');
    writeLockFile(tempDir, ['.claude/file.txt']);

    await clean();

    expect(existsSync(join(tempDir, '.claude', 'file.txt'))).toBe(false);
    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Removed 1 files'));
  });

  it('shows what would be removed in dry-run mode', async () => {
    createTestFile(join(tempDir, '.claude', 'file.txt'), 'content');
    writeLockFile(tempDir, ['.claude/file.txt']);

    await clean({ dryRun: true });

    expect(existsSync(join(tempDir, '.claude', 'file.txt'))).toBe(true);
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('dry-run')
    );
  });

  it('updates lock file after cleaning', async () => {
    createTestFile(join(tempDir, '.claude', 'file.txt'), 'content');
    writeLockFile(tempDir, ['.claude/file.txt']);

    await clean();

    const remainingFiles = getTrackedFiles(tempDir);
    expect(remainingFiles).toEqual([]);
  });

  it('handles already missing files gracefully', async () => {
    writeLockFile(tempDir, ['.claude/nonexistent.txt']);

    await clean();

    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Removed 0 files'));
  });
});
