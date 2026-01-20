import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  loadRepoConfig,
  saveRepoConfig,
  repoConfigExists,
  validateRepoConfig,
} from './repo-config.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestFile,
  createTestRepo,
} from '../test-utils.js';

describe('repo-config', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('repoConfigExists', () => {
    it('returns false when repo.json does not exist', () => {
      expect(repoConfigExists(tempDir)).toBe(false);
    });

    it('returns true when repo.json exists', () => {
      createTestRepo(tempDir);
      expect(repoConfigExists(tempDir)).toBe(true);
    });
  });

  describe('loadRepoConfig', () => {
    it('loads valid repo config', () => {
      createTestRepo(tempDir, ['development', 'writing']);

      const config = loadRepoConfig(tempDir);

      expect(config.name).toBe('test-repo');
      expect(config['use-cases']).toHaveProperty('development');
      expect(config['use-cases']).toHaveProperty('writing');
    });

    it('throws when repo.json does not exist', () => {
      expect(() => loadRepoConfig(tempDir)).toThrow();
    });

    it('throws on invalid JSON', () => {
      createTestFile(join(tempDir, 'repo.json'), 'not json');
      expect(() => loadRepoConfig(tempDir)).toThrow();
    });
  });

  describe('saveRepoConfig', () => {
    it('saves repo config to file', () => {
      const config = {
        name: 'my-repo',
        'use-cases': {
          development: { description: 'Dev tasks' },
        },
      };

      saveRepoConfig(tempDir, config);

      const content = readFileSync(join(tempDir, 'repo.json'), 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed.name).toBe('my-repo');
    });

    it('overwrites existing config', () => {
      createTestRepo(tempDir);

      const newConfig = {
        name: 'updated-repo',
        'use-cases': {
          writing: { description: 'Writing tasks' },
        },
      };

      saveRepoConfig(tempDir, newConfig);

      const config = loadRepoConfig(tempDir);
      expect(config.name).toBe('updated-repo');
      expect(config['use-cases']).not.toHaveProperty('development');
      expect(config['use-cases']).toHaveProperty('writing');
    });
  });

  describe('validateRepoConfig', () => {
    it('returns empty array for valid config', () => {
      const config = {
        name: 'my-repo',
        'use-cases': {
          development: { description: 'Dev tasks' },
        },
      };

      expect(validateRepoConfig(config)).toEqual([]);
    });

    it('returns error for missing name', () => {
      const config = {
        'use-cases': {
          development: { description: 'Dev tasks' },
        },
      };

      const errors = validateRepoConfig(config);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('returns error for missing use-cases', () => {
      const config = { name: 'my-repo' };

      const errors = validateRepoConfig(config);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
