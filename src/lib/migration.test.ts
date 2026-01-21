import { describe, it, expect } from 'vitest';
import {
  migrateAmgrConfig,
  migrateRepoConfig,
  shouldMigrateAmgrConfig,
  shouldMigrateRepoConfig,
} from './migration.js';
import type { AmgrConfig } from '../types/config.js';
import type { RepoConfig } from '../types/repo.js';

describe('migration', () => {
  describe('shouldMigrateAmgrConfig', () => {
    it('returns true when use-cases present and profiles missing', () => {
      const config = {
        targets: ['claudecode'],
        features: ['rules'],
        'use-cases': ['development'],
      } as AmgrConfig;
      expect(shouldMigrateAmgrConfig(config)).toBe(true);
    });

    it('returns false when profiles present', () => {
      const config = {
        targets: ['claudecode'],
        features: ['rules'],
        profiles: ['development'],
      } as AmgrConfig;
      expect(shouldMigrateAmgrConfig(config)).toBe(false);
    });

    it('returns false when both present', () => {
      const config = {
        targets: ['claudecode'],
        features: ['rules'],
        'use-cases': ['development'],
        profiles: ['writing'],
      } as AmgrConfig;
      expect(shouldMigrateAmgrConfig(config)).toBe(false);
    });

    it('returns false when neither present', () => {
      const config = {
        targets: ['claudecode'],
        features: ['rules'],
      } as AmgrConfig;
      expect(shouldMigrateAmgrConfig(config)).toBe(false);
    });
  });

  describe('migrateAmgrConfig', () => {
    it('migrates use-cases to profiles', () => {
      const config = {
        targets: ['claudecode'],
        features: ['rules'],
        'use-cases': ['development', 'writing'],
      } as AmgrConfig;

      const result = migrateAmgrConfig(config);

      expect(result.migrated).toBe(true);
      expect(result.config.profiles).toEqual(['development', 'writing']);
      expect(result.config['use-cases']).toBeUndefined();
      expect(result.messages).toContain('Migrated "use-cases" to "profiles" field');
    });

    it('does not modify config with profiles', () => {
      const config = {
        targets: ['claudecode'],
        features: ['rules'],
        profiles: ['development'],
      } as AmgrConfig;

      const result = migrateAmgrConfig(config);

      expect(result.migrated).toBe(false);
      expect(result.config.profiles).toEqual(['development']);
      expect(result.messages).toHaveLength(0);
    });

    it('preserves other config fields', () => {
      const config = {
        targets: ['claudecode', 'cursor'],
        features: ['rules', 'commands'],
        'use-cases': ['development'],
        options: { simulateCommands: true },
      } as AmgrConfig;

      const result = migrateAmgrConfig(config);

      expect(result.config.targets).toEqual(['claudecode', 'cursor']);
      expect(result.config.features).toEqual(['rules', 'commands']);
      expect(result.config.options).toEqual({ simulateCommands: true });
    });
  });

  describe('shouldMigrateRepoConfig', () => {
    it('returns true when use-cases present and profiles missing', () => {
      const config = {
        name: 'test',
        'use-cases': { development: { description: 'Dev' } },
      } as RepoConfig;
      expect(shouldMigrateRepoConfig(config)).toBe(true);
    });

    it('returns false when profiles present', () => {
      const config = {
        name: 'test',
        profiles: { development: { description: 'Dev' } },
      } as RepoConfig;
      expect(shouldMigrateRepoConfig(config)).toBe(false);
    });
  });

  describe('migrateRepoConfig', () => {
    it('migrates use-cases to profiles structure', () => {
      const config = {
        name: 'test',
        'use-cases': {
          development: { description: 'Development profile' },
          writing: { description: 'Writing profile' },
        },
      } as RepoConfig;

      const result = migrateRepoConfig(config);

      expect(result.migrated).toBe(true);
      expect(result.config.profiles).toEqual({
        development: { description: 'Development profile' },
        writing: { description: 'Writing profile' },
      });
      expect(result.messages).toContain('Migrated "use-cases" to "profiles" field');
    });

    it('does not modify config with profiles', () => {
      const config = {
        name: 'test',
        profiles: { development: { description: 'Dev' } },
      } as RepoConfig;

      const result = migrateRepoConfig(config);

      expect(result.migrated).toBe(false);
      expect(result.config.profiles).toEqual({ development: { description: 'Dev' } });
    });

    it('preserves other repo fields', () => {
      const config = {
        name: 'test-repo',
        description: 'A test repo',
        version: '1.0.0',
        author: 'Test Author',
        'use-cases': { dev: { description: 'Dev' } },
      } as RepoConfig;

      const result = migrateRepoConfig(config);

      expect(result.config.name).toBe('test-repo');
      expect(result.config.description).toBe('A test repo');
      expect(result.config.version).toBe('1.0.0');
      expect(result.config.author).toBe('Test Author');
    });
  });
});
