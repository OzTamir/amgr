import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  loadRepoConfig,
  saveRepoConfig,
  repoConfigExists,
  validateRepoConfig,
  profileExistsInRepo,
  addProfileToRepo,
  removeProfileFromRepo,
  initNestedProfile,
  getRepoProfiles,
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

    it('accepts config with profiles instead of use-cases', () => {
      const config = {
        name: 'my-repo',
        profiles: {
          development: { description: 'Dev tasks' },
        },
      };

      expect(validateRepoConfig(config)).toEqual([]);
    });
  });

  describe('profileExistsInRepo', () => {
    it('returns false for non-existent flat profile', () => {
      createTestRepo(tempDir);
      expect(profileExistsInRepo(tempDir, 'missing')).toBe(false);
    });

    it('returns true for existing profile', () => {
      const config = {
        name: 'test-repo',
        profiles: { development: { description: 'Dev' } },
      };
      saveRepoConfig(tempDir, config);
      expect(profileExistsInRepo(tempDir, 'development')).toBe(true);
    });

    it('returns true for existing sub-profile', () => {
      const config = {
        name: 'test-repo',
        profiles: {
          development: {
            description: 'Dev',
            'sub-profiles': { frontend: { description: 'Frontend' } },
          },
        },
      };
      saveRepoConfig(tempDir, config);
      expect(profileExistsInRepo(tempDir, 'development:frontend')).toBe(true);
    });

    it('returns false for non-existent sub-profile', () => {
      const config = {
        name: 'test-repo',
        profiles: {
          development: {
            description: 'Dev',
            'sub-profiles': { frontend: { description: 'Frontend' } },
          },
        },
      };
      saveRepoConfig(tempDir, config);
      expect(profileExistsInRepo(tempDir, 'development:backend')).toBe(false);
    });
  });

  describe('addProfileToRepo', () => {
    beforeEach(() => {
      const config = { name: 'test-repo', profiles: {} };
      saveRepoConfig(tempDir, config);
    });

    it('adds flat profile', () => {
      addProfileToRepo(tempDir, 'writing', 'Writing tasks');
      
      const config = loadRepoConfig(tempDir);
      expect(config.profiles?.['writing']).toEqual({ description: 'Writing tasks' });
    });

    it('throws when flat profile already exists', () => {
      addProfileToRepo(tempDir, 'writing', 'Writing tasks');
      expect(() => addProfileToRepo(tempDir, 'writing', 'Duplicate')).toThrow(/already exists/);
    });

    it('adds sub-profile to existing parent', () => {
      initNestedProfile(tempDir, 'development', 'Dev tasks');
      addProfileToRepo(tempDir, 'development:frontend', 'Frontend dev');
      
      const config = loadRepoConfig(tempDir);
      expect(config.profiles?.['development']?.['sub-profiles']?.['frontend']).toEqual({ 
        description: 'Frontend dev' 
      });
    });

    it('throws when parent does not exist', () => {
      expect(() => addProfileToRepo(tempDir, 'missing:sub', 'Sub')).toThrow(/does not exist/);
    });

    it('throws when sub-profile already exists', () => {
      initNestedProfile(tempDir, 'development', 'Dev');
      addProfileToRepo(tempDir, 'development:frontend', 'Frontend');
      expect(() => addProfileToRepo(tempDir, 'development:frontend', 'Dup')).toThrow(/already exists/);
    });
  });

  describe('removeProfileFromRepo', () => {
    it('removes flat profile', () => {
      const config = {
        name: 'test-repo',
        profiles: { 
          writing: { description: 'Writing' },
          development: { description: 'Dev' },
        },
      };
      saveRepoConfig(tempDir, config);
      
      removeProfileFromRepo(tempDir, 'writing');
      
      const updated = loadRepoConfig(tempDir);
      expect(updated.profiles?.['writing']).toBeUndefined();
      expect(updated.profiles?.['development']).toBeDefined();
    });

    it('removes sub-profile', () => {
      const config = {
        name: 'test-repo',
        profiles: {
          development: {
            description: 'Dev',
            'sub-profiles': {
              frontend: { description: 'Frontend' },
              backend: { description: 'Backend' },
            },
          },
        },
      };
      saveRepoConfig(tempDir, config);
      
      removeProfileFromRepo(tempDir, 'development:frontend');
      
      const updated = loadRepoConfig(tempDir);
      expect(updated.profiles?.['development']?.['sub-profiles']?.['frontend']).toBeUndefined();
      expect(updated.profiles?.['development']?.['sub-profiles']?.['backend']).toBeDefined();
    });

    it('throws for non-existent profile', () => {
      const config = { name: 'test-repo', profiles: {} };
      saveRepoConfig(tempDir, config);
      
      expect(() => removeProfileFromRepo(tempDir, 'missing')).toThrow(/does not exist/);
    });
  });

  describe('initNestedProfile', () => {
    beforeEach(() => {
      const config = { name: 'test-repo', profiles: {} };
      saveRepoConfig(tempDir, config);
    });

    it('creates nested profile with empty sub-profiles', () => {
      initNestedProfile(tempDir, 'development', 'Dev tasks');
      
      const config = loadRepoConfig(tempDir);
      expect(config.profiles?.['development']).toEqual({
        description: 'Dev tasks',
        'sub-profiles': {},
      });
    });

    it('throws when profile already exists', () => {
      initNestedProfile(tempDir, 'development', 'Dev');
      expect(() => initNestedProfile(tempDir, 'development', 'Dup')).toThrow(/already exists/);
    });
  });

  describe('getRepoProfiles', () => {
    it('returns empty array for empty profiles', () => {
      const config = { name: 'test-repo', profiles: {} };
      saveRepoConfig(tempDir, config);
      
      expect(getRepoProfiles(tempDir)).toEqual([]);
    });

    it('returns flat profile names', () => {
      const config = {
        name: 'test-repo',
        profiles: {
          writing: { description: 'Writing' },
          documentation: { description: 'Docs' },
        },
      };
      saveRepoConfig(tempDir, config);
      
      expect(getRepoProfiles(tempDir)).toEqual(['writing', 'documentation']);
    });

    it('returns expanded sub-profile names', () => {
      const config = {
        name: 'test-repo',
        profiles: {
          development: {
            description: 'Dev',
            'sub-profiles': {
              frontend: { description: 'Frontend' },
              backend: { description: 'Backend' },
            },
          },
        },
      };
      saveRepoConfig(tempDir, config);
      
      expect(getRepoProfiles(tempDir)).toEqual(['development:frontend', 'development:backend']);
    });

    it('includes legacy use-cases', () => {
      const config = {
        name: 'test-repo',
        'use-cases': {
          writing: { description: 'Writing' },
        },
        profiles: {
          documentation: { description: 'Docs' },
        },
      };
      saveRepoConfig(tempDir, config);
      
      const profiles = getRepoProfiles(tempDir);
      expect(profiles).toContain('writing');
      expect(profiles).toContain('documentation');
    });
  });
});
