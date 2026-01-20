import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import {
  getLockPath,
  readLockFile,
  writeLockFile,
  getTrackedFiles,
  isTrackedFile,
  removeTrackedFiles,
  deleteLockFile,
  lockFileExists,
} from './lock.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestFile,
  createMockLogger,
} from '../test-utils.js';

describe('lock', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('getLockPath', () => {
    it('returns lock file path in .amgr directory', () => {
      expect(getLockPath('/project')).toBe('/project/.amgr/amgr-lock.json');
    });
  });

  describe('readLockFile', () => {
    it('returns null when lock file does not exist', () => {
      expect(readLockFile(tempDir)).toBeNull();
    });

    it('reads valid lock file', () => {
      const lockPath = join(tempDir, '.amgr', 'amgr-lock.json');
      mkdirSync(join(tempDir, '.amgr'), { recursive: true });
      writeFileSync(
        lockPath,
        JSON.stringify({
          version: '1.0.0',
          created: '2024-01-01T00:00:00.000Z',
          lastSynced: '2024-01-01T00:00:00.000Z',
          files: ['file1.txt', 'file2.txt'],
        })
      );

      const result = readLockFile(tempDir);
      expect(result).not.toBeNull();
      expect(result?.files).toEqual(['file1.txt', 'file2.txt']);
    });

    it('returns null for invalid JSON', () => {
      const lockPath = join(tempDir, '.amgr', 'amgr-lock.json');
      mkdirSync(join(tempDir, '.amgr'), { recursive: true });
      writeFileSync(lockPath, 'not json');

      expect(readLockFile(tempDir)).toBeNull();
    });

    it('returns null for invalid schema', () => {
      const lockPath = join(tempDir, '.amgr', 'amgr-lock.json');
      mkdirSync(join(tempDir, '.amgr'), { recursive: true });
      writeFileSync(lockPath, JSON.stringify({ invalid: 'schema' }));

      expect(readLockFile(tempDir)).toBeNull();
    });
  });

  describe('writeLockFile', () => {
    it('creates lock file with files', () => {
      writeLockFile(tempDir, ['file1.txt', 'file2.txt']);

      const lockPath = getLockPath(tempDir);
      expect(existsSync(lockPath)).toBe(true);

      const result = readLockFile(tempDir);
      expect(result?.files).toEqual(['file1.txt', 'file2.txt']);
    });

    it('creates .amgr directory if it does not exist', () => {
      const amgrDir = join(tempDir, '.amgr');
      expect(existsSync(amgrDir)).toBe(false);

      writeLockFile(tempDir, ['file.txt']);

      expect(existsSync(amgrDir)).toBe(true);
    });

    it('deduplicates and sorts files', () => {
      writeLockFile(tempDir, ['b.txt', 'a.txt', 'b.txt']);

      const result = readLockFile(tempDir);
      expect(result?.files).toEqual(['a.txt', 'b.txt']);
    });

    it('preserves created timestamp on update', () => {
      writeLockFile(tempDir, ['file1.txt']);
      const first = readLockFile(tempDir);

      writeLockFile(tempDir, ['file2.txt']);
      const second = readLockFile(tempDir);

      expect(second?.created).toBe(first?.created);
    });

    it('updates lastSynced timestamp', () => {
      writeLockFile(tempDir, ['file1.txt']);
      const first = readLockFile(tempDir);

      writeLockFile(tempDir, ['file2.txt']);
      const second = readLockFile(tempDir);

      expect(new Date(second!.lastSynced).getTime()).toBeGreaterThanOrEqual(
        new Date(first!.lastSynced).getTime()
      );
    });
  });

  describe('getTrackedFiles', () => {
    it('returns empty array when no lock file', () => {
      expect(getTrackedFiles(tempDir)).toEqual([]);
    });

    it('returns files from lock file', () => {
      writeLockFile(tempDir, ['file1.txt', 'file2.txt']);
      expect(getTrackedFiles(tempDir)).toEqual(['file1.txt', 'file2.txt']);
    });
  });

  describe('isTrackedFile', () => {
    it('returns false when no lock file', () => {
      expect(isTrackedFile(tempDir, 'file.txt')).toBe(false);
    });

    it('returns true for tracked file', () => {
      writeLockFile(tempDir, ['tracked.txt']);
      expect(isTrackedFile(tempDir, 'tracked.txt')).toBe(true);
    });

    it('returns false for untracked file', () => {
      writeLockFile(tempDir, ['tracked.txt']);
      expect(isTrackedFile(tempDir, 'untracked.txt')).toBe(false);
    });
  });

  describe('removeTrackedFiles', () => {
    it('removes tracked files that exist', () => {
      createTestFile(join(tempDir, 'file1.txt'), 'content');
      createTestFile(join(tempDir, 'file2.txt'), 'content');
      writeLockFile(tempDir, ['file1.txt', 'file2.txt']);

      const result = removeTrackedFiles(tempDir);

      expect(result.removed).toContain('file1.txt');
      expect(result.removed).toContain('file2.txt');
      expect(existsSync(join(tempDir, 'file1.txt'))).toBe(false);
      expect(existsSync(join(tempDir, 'file2.txt'))).toBe(false);
    });

    it('handles missing files gracefully', () => {
      writeLockFile(tempDir, ['nonexistent.txt']);

      const result = removeTrackedFiles(tempDir);

      expect(result.removed).toEqual([]);
      expect(result.failed).toEqual([]);
    });

    it('respects dry run option', () => {
      createTestFile(join(tempDir, 'file.txt'), 'content');
      writeLockFile(tempDir, ['file.txt']);

      const result = removeTrackedFiles(tempDir, { dryRun: true });

      expect(result.removed).toContain('file.txt');
      expect(existsSync(join(tempDir, 'file.txt'))).toBe(true);
    });

    it('logs with provided logger in verbose mode', () => {
      createTestFile(join(tempDir, 'file.txt'), 'content');
      writeLockFile(tempDir, ['file.txt']);
      const logger = createMockLogger();

      removeTrackedFiles(tempDir, { verbose: true, logger });

      expect(logger.logs.verbose.some((m) => m.includes('file.txt'))).toBe(true);
    });

    it('cleans empty directories after removal', () => {
      const nestedDir = join(tempDir, 'nested', 'dir');
      mkdirSync(nestedDir, { recursive: true });
      createTestFile(join(nestedDir, 'file.txt'), 'content');
      writeLockFile(tempDir, ['nested/dir/file.txt']);

      removeTrackedFiles(tempDir);

      expect(existsSync(join(tempDir, 'nested'))).toBe(false);
    });
  });

  describe('deleteLockFile', () => {
    it('deletes lock file when it exists', () => {
      writeLockFile(tempDir, ['file.txt']);
      const lockPath = getLockPath(tempDir);
      expect(existsSync(lockPath)).toBe(true);

      const result = deleteLockFile(tempDir);

      expect(result).toBe(true);
      expect(existsSync(lockPath)).toBe(false);
    });

    it('returns false when lock file does not exist', () => {
      expect(deleteLockFile(tempDir)).toBe(false);
    });
  });

  describe('lockFileExists', () => {
    it('returns false when lock file does not exist', () => {
      expect(lockFileExists(tempDir)).toBe(false);
    });

    it('returns true when lock file exists', () => {
      writeLockFile(tempDir, ['file.txt']);
      expect(lockFileExists(tempDir)).toBe(true);
    });
  });
});
