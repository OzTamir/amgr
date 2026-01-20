import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { repoInit, repoAdd, repoRemove, repoList } from './repo.js';
import { loadRepoConfig } from '../lib/repo-config.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestRepo,
} from '../test-utils.js';

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
  confirm: vi.fn(),
}));

import { input, confirm } from '@inquirer/prompts';

describe('repo commands', () => {
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

  describe('repoInit', () => {
    it('creates repo structure with provided options', async () => {
      await repoInit({
        name: 'test-repo',
        description: 'Test description',
        author: 'Test Author',
      });

      expect(existsSync(join(tempDir, 'repo.json'))).toBe(true);
      expect(existsSync(join(tempDir, 'shared'))).toBe(true);
      expect(existsSync(join(tempDir, 'use-cases'))).toBe(true);

      const config = loadRepoConfig(tempDir);
      expect(config.name).toBe('test-repo');
      expect(config.description).toBe('Test description');
      expect(config.author).toBe('Test Author');
    });

    it('prompts for confirmation when repo already exists', async () => {
      createTestRepo(tempDir);

      vi.mocked(confirm).mockResolvedValue(false);

      await repoInit({ name: 'new-name' });

      expect(confirm).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Aborted')
      );
    });

    it('reinitializes when user confirms', async () => {
      createTestRepo(tempDir);

      vi.mocked(confirm).mockResolvedValue(true);

      await repoInit({
        name: 'new-name',
        description: '',
        author: '',
      });

      const config = loadRepoConfig(tempDir);
      expect(config.name).toBe('new-name');
    });
  });

  describe('repoAdd', () => {
    beforeEach(() => {
      createTestRepo(tempDir, []);
    });

    it('adds a new use-case', async () => {
      vi.mocked(input).mockResolvedValue('Development tasks');

      await repoAdd('development', { description: 'Development tasks' });

      const config = loadRepoConfig(tempDir);
      expect(config['use-cases']).toHaveProperty('development');
      expect(existsSync(join(tempDir, 'use-cases', 'development'))).toBe(true);
    });

    it('shows error when not in a repo', async () => {
      process.chdir(originalCwd);
      const nonRepoDir = createTempDir();
      process.chdir(nonRepoDir);

      try {
        await repoAdd('test');

        expect(consoleSpy.error).toHaveBeenCalledWith(
          expect.stringContaining('Not an amgr repo')
        );
      } finally {
        process.chdir(tempDir);
        cleanupTempDir(nonRepoDir);
      }
    });

    it('shows error for empty name', async () => {
      await repoAdd('');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('name is required')
      );
    });

    it('shows error when use-case already exists', async () => {
      vi.mocked(input).mockResolvedValue('First');
      await repoAdd('existing', { description: 'First' });

      await repoAdd('existing', { description: 'Second' });

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('already exists')
      );
    });
  });

  describe('repoRemove', () => {
    beforeEach(() => {
      createTestRepo(tempDir, ['development', 'writing']);
    });

    it('removes use-case with force flag', async () => {
      await repoRemove('development', { force: true });

      const config = loadRepoConfig(tempDir);
      expect(config['use-cases']).not.toHaveProperty('development');
      expect(existsSync(join(tempDir, 'use-cases', 'development'))).toBe(false);
    });

    it('prompts for confirmation without force flag', async () => {
      vi.mocked(confirm).mockResolvedValue(false);

      await repoRemove('development');

      expect(confirm).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Aborted')
      );
    });

    it('shows error for non-existent use-case', async () => {
      await repoRemove('nonexistent', { force: true });

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('does not exist')
      );
    });
  });

  describe('repoList', () => {
    it('lists use-cases in repo', async () => {
      createTestRepo(tempDir, ['development', 'writing']);

      await repoList();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('test-repo')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('development')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('writing')
      );
    });

    it('shows error when not in a repo', async () => {
      await repoList();

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Not an amgr repo')
      );
    });

    it('shows message when no use-cases', async () => {
      createTestRepo(tempDir, []);

      await repoList();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('(none)')
      );
    });
  });
});
