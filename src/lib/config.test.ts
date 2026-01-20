import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  getConfigPath,
  getAmgrDir,
  configExists,
  loadConfig,
  normalizeOutputDirPrefix,
  validateOutputDirs,
  validateConfig,
  loadAndValidateConfig,
  saveConfig,
  hasSources,
  addSourceToConfig,
  removeSourceFromConfig,
  getEffectiveOptions,
  expandTargets,
} from './config.js';
import { VALID_TARGETS } from '../types/config.js';
import type { AmgrConfig } from '../types/config.js';
import type { Source } from '../types/sources.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestConfig,
  createTestProject,
} from '../test-utils.js';

describe('config', () => {
  describe('getConfigPath', () => {
    it('returns custom path when provided', () => {
      expect(getConfigPath('/project', '/custom/config.json')).toBe(
        '/custom/config.json'
      );
    });

    it('returns default path when no custom path', () => {
      expect(getConfigPath('/project')).toBe('/project/.amgr/config.json');
    });

    it('uses AMGR_CONFIG env var when set', () => {
      const originalEnv = process.env['AMGR_CONFIG'];
      process.env['AMGR_CONFIG'] = '/env/config.json';

      expect(getConfigPath('/project')).toBe('/env/config.json');

      if (originalEnv === undefined) {
        delete process.env['AMGR_CONFIG'];
      } else {
        process.env['AMGR_CONFIG'] = originalEnv;
      }
    });

    it('custom path takes precedence over env var', () => {
      const originalEnv = process.env['AMGR_CONFIG'];
      process.env['AMGR_CONFIG'] = '/env/config.json';

      expect(getConfigPath('/project', '/custom/config.json')).toBe(
        '/custom/config.json'
      );

      if (originalEnv === undefined) {
        delete process.env['AMGR_CONFIG'];
      } else {
        process.env['AMGR_CONFIG'] = originalEnv;
      }
    });
  });

  describe('getAmgrDir', () => {
    it('returns .amgr directory path', () => {
      expect(getAmgrDir('/project')).toBe('/project/.amgr');
    });
  });

  describe('normalizeOutputDirPrefix', () => {
    it.each([
      { input: 'docs', expected: 'docs/' },
      { input: 'docs/', expected: 'docs/' },
      { input: '', expected: '' },
      { input: '  ', expected: '' },
      { input: 'path/to/dir', expected: 'path/to/dir/' },
      { input: 'path/to/dir/', expected: 'path/to/dir/' },
    ] as const)('normalizes "$input" to "$expected"', ({ input, expected }) => {
      expect(normalizeOutputDirPrefix(input)).toBe(expected);
    });
  });

  describe('validateOutputDirs', () => {
    it('returns empty array for undefined outputDirs', () => {
      expect(validateOutputDirs(undefined, ['development'])).toEqual([]);
    });

    it('returns empty array for valid outputDirs', () => {
      const errors = validateOutputDirs(
        { development: 'docs/' },
        ['development']
      );
      expect(errors).toEqual([]);
    });

    it('returns error for unknown use-case', () => {
      const errors = validateOutputDirs({ unknown: 'docs/' }, ['development']);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("unknown use-case 'unknown'");
    });

    it('returns error for absolute path', () => {
      const errors = validateOutputDirs(
        { development: '/absolute/path' },
        ['development']
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('must be a relative path');
    });

    it('returns error for path traversal', () => {
      const errors = validateOutputDirs(
        { development: '../parent/dir' },
        ['development']
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("must not contain '..'");
    });

    it('returns multiple errors for multiple issues', () => {
      const errors = validateOutputDirs(
        {
          unknown: 'docs/',
          development: '/absolute',
        },
        ['development']
      );
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('validateConfig', () => {
    it('returns empty array for valid config', () => {
      const config = createTestConfig();
      expect(validateConfig(config)).toEqual([]);
    });

    it('returns error for missing targets', () => {
      const config = { features: ['rules'], 'use-cases': ['development'] };
      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('returns error for empty targets array', () => {
      const config = createTestConfig({ targets: [] });
      const errors = validateConfig(config);
      expect(errors.some((e) => e.includes('target'))).toBe(true);
    });

    it('returns error for invalid target', () => {
      const config = {
        targets: ['invalid-target'],
        features: ['rules'],
        'use-cases': ['development'],
      };
      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('returns error for invalid feature', () => {
      const config = {
        targets: ['claudecode'],
        features: ['invalid-feature'],
        'use-cases': ['development'],
      };
      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('validates sources when present', () => {
      const config = createTestConfig({
        sources: [{ type: 'git' }] as unknown as Source[],
      });
      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.toLowerCase().includes('url') || e.toLowerCase().includes('source'))).toBe(true);
    });

    it('validates outputDirs when present', () => {
      const config = createTestConfig({
        outputDirs: { unknown: 'docs/' },
      });
      const errors = validateConfig(config);
      expect(errors.some((e) => e.includes('unknown'))).toBe(true);
    });
  });

  describe('hasSources', () => {
    it('returns false when sources is undefined', () => {
      const config = createTestConfig();
      expect(hasSources(config)).toBe(false);
    });

    it('returns false when sources is empty array', () => {
      const config = createTestConfig({ sources: [] });
      expect(hasSources(config)).toBe(false);
    });

    it('returns true when sources has items', () => {
      const config = createTestConfig({
        sources: [{ type: 'local', path: '/path' }],
      });
      expect(hasSources(config)).toBe(true);
    });
  });

  describe('addSourceToConfig', () => {
    const newSource: Source = { type: 'local', path: '/new/path' };

    it('appends source to empty sources', () => {
      const config = createTestConfig();
      const result = addSourceToConfig(config, newSource);
      expect(result.sources).toEqual([newSource]);
    });

    it('appends source to existing sources by default', () => {
      const existingSource: Source = { type: 'local', path: '/existing' };
      const config = createTestConfig({ sources: [existingSource] });
      const result = addSourceToConfig(config, newSource);
      expect(result.sources).toEqual([existingSource, newSource]);
    });

    it('inserts source at specified position', () => {
      const source1: Source = { type: 'local', path: '/first' };
      const source2: Source = { type: 'local', path: '/second' };
      const config = createTestConfig({ sources: [source1, source2] });

      const result = addSourceToConfig(config, newSource, 1);
      expect(result.sources).toEqual([source1, newSource, source2]);
    });

    it('inserts at beginning when position is 0', () => {
      const existingSource: Source = { type: 'local', path: '/existing' };
      const config = createTestConfig({ sources: [existingSource] });

      const result = addSourceToConfig(config, newSource, 0);
      expect(result.sources).toEqual([newSource, existingSource]);
    });

    it('does not mutate original config', () => {
      const config = createTestConfig();
      const result = addSourceToConfig(config, newSource);
      expect(config.sources).toBeUndefined();
      expect(result.sources).toBeDefined();
    });
  });

  describe('removeSourceFromConfig', () => {
    it('removes source at specified index', () => {
      const source1: Source = { type: 'local', path: '/first' };
      const source2: Source = { type: 'local', path: '/second' };
      const config = createTestConfig({ sources: [source1, source2] });

      const result = removeSourceFromConfig(config, 0);
      expect(result.sources).toEqual([source2]);
    });

    it('removes sources property when last source is removed', () => {
      const source: Source = { type: 'local', path: '/only' };
      const config = createTestConfig({ sources: [source] });

      const result = removeSourceFromConfig(config, 0);
      expect(result.sources).toBeUndefined();
    });

    it('throws for invalid index', () => {
      const config = createTestConfig({ sources: [{ type: 'local', path: '/path' }] });
      expect(() => removeSourceFromConfig(config, -1)).toThrow('Invalid source index');
      expect(() => removeSourceFromConfig(config, 5)).toThrow('Invalid source index');
    });

    it('throws when sources is undefined', () => {
      const config = createTestConfig();
      expect(() => removeSourceFromConfig(config, 0)).toThrow('Invalid source index');
    });

    it('does not mutate original config', () => {
      const source: Source = { type: 'local', path: '/path' };
      const config = createTestConfig({ sources: [source] });
      const originalSources = config.sources;

      removeSourceFromConfig(config, 0);
      expect(config.sources).toBe(originalSources);
    });
  });

  describe('getEffectiveOptions', () => {
    it('returns defaults when no options provided', () => {
      const config = createTestConfig();
      const options = getEffectiveOptions(config);

      expect(options.simulateCommands).toBe(false);
      expect(options.simulateSubagents).toBe(false);
      expect(options.simulateSkills).toBe(false);
      expect(options.modularMcp).toBe(false);
      expect(options.ignoreGlobalSources).toBe(false);
      expect(options.globalSourcesPosition).toBe('prepend');
    });

    it('merges provided options with defaults', () => {
      const config = createTestConfig({
        options: { simulateCommands: true, modularMcp: true },
      });
      const options = getEffectiveOptions(config);

      expect(options.simulateCommands).toBe(true);
      expect(options.modularMcp).toBe(true);
      expect(options.simulateSubagents).toBe(false);
    });
  });

  describe('expandTargets', () => {
    it('returns all valid targets when wildcard is present', () => {
      const result = expandTargets(['*']);
      expect(result).toEqual([...VALID_TARGETS]);
    });

    it('returns specific targets when no wildcard', () => {
      const result = expandTargets(['claudecode', 'cursor']);
      expect(result).toEqual(['claudecode', 'cursor']);
    });

    it('expands wildcard even with other targets', () => {
      const result = expandTargets(['claudecode', '*']);
      expect(result).toEqual([...VALID_TARGETS]);
    });
  });

  describe('file system operations', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = createTempDir();
    });

    afterEach(() => {
      cleanupTempDir(tempDir);
    });

    describe('configExists', () => {
      it('returns false when config does not exist', () => {
        expect(configExists(tempDir)).toBe(false);
      });

      it('returns true when config exists', () => {
        createTestProject(tempDir, createTestConfig());
        expect(configExists(tempDir)).toBe(true);
      });

      it('checks custom path when provided', () => {
        const customPath = join(tempDir, 'custom.json');
        expect(configExists(tempDir, customPath)).toBe(false);
      });
    });

    describe('loadConfig', () => {
      it('loads valid config file', () => {
        const config = createTestConfig();
        createTestProject(tempDir, config);

        const loaded = loadConfig(tempDir);
        expect(loaded).toEqual(config);
      });

      it('throws when config file does not exist', () => {
        expect(() => loadConfig(tempDir)).toThrow('No .amgr/config.json found');
      });

      it('throws on invalid JSON', () => {
        const configPath = join(tempDir, '.amgr', 'config.json');
        require('node:fs').mkdirSync(join(tempDir, '.amgr'), { recursive: true });
        require('node:fs').writeFileSync(configPath, 'not json');

        expect(() => loadConfig(tempDir)).toThrow('Invalid JSON');
      });
    });

    describe('saveConfig', () => {
      it('saves config to file', () => {
        require('node:fs').mkdirSync(join(tempDir, '.amgr'), { recursive: true });
        const config = createTestConfig();

        saveConfig(tempDir, config);

        const content = readFileSync(join(tempDir, '.amgr', 'config.json'), 'utf8');
        expect(JSON.parse(content)).toEqual(config);
      });

      it('overwrites existing config', () => {
        createTestProject(tempDir, createTestConfig({ targets: ['claudecode'] }));
        const newConfig = createTestConfig({ targets: ['cursor'] });

        saveConfig(tempDir, newConfig);

        const loaded = loadConfig(tempDir);
        expect(loaded.targets).toEqual(['cursor']);
      });
    });

    describe('loadAndValidateConfig', () => {
      it('loads and returns valid config', () => {
        const config = createTestConfig();
        createTestProject(tempDir, config);

        const loaded = loadAndValidateConfig(tempDir);
        expect(loaded).toEqual(config);
      });

      it('throws on validation error', () => {
        const invalidConfig = { targets: [], features: ['rules'], 'use-cases': ['dev'] };
        createTestProject(tempDir, invalidConfig as unknown as AmgrConfig);

        expect(() => loadAndValidateConfig(tempDir)).toThrow();
      });
    });
  });
});
