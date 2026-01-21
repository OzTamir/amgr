import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import {
  getAvailableUseCases,
  getAvailableUseCasesFromSources,
  compose,
  composeWithProfiles,
  detectProfileType,
  generateRulesyncConfig,
  writeRulesyncConfig,
} from './compose.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestRepo,
  createMockLogger,
  createTestFile,
} from '../test-utils.js';

describe('compose', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('getAvailableUseCases', () => {
    it('returns empty array when use-cases directory does not exist', () => {
      expect(getAvailableUseCases(tempDir)).toEqual([]);
    });

    it('returns list of use-case directories', () => {
      createTestRepo(tempDir, ['development', 'writing']);

      const useCases = getAvailableUseCases(tempDir);

      expect(useCases).toContain('development');
      expect(useCases).toContain('writing');
    });

    it('ignores files in use-cases directory', () => {
      createTestRepo(tempDir, ['development']);
      writeFileSync(join(tempDir, 'use-cases', 'readme.md'), 'content');

      const useCases = getAvailableUseCases(tempDir);

      expect(useCases).toEqual(['development']);
    });
  });

  describe('getAvailableUseCasesFromSources', () => {
    it('combines use-cases from multiple sources', () => {
      const source1 = createTempDir();
      const source2 = createTempDir();

      try {
        createTestRepo(source1, ['development']);
        createTestRepo(source2, ['writing']);

        const result = getAvailableUseCasesFromSources([source1, source2]);

        expect(result).toHaveProperty('development');
        expect(result).toHaveProperty('writing');
      } finally {
        cleanupTempDir(source1);
        cleanupTempDir(source2);
      }
    });

    it('tracks sources for each use-case', () => {
      const source1 = createTempDir();
      const source2 = createTempDir();

      try {
        createTestRepo(source1, ['shared-use-case']);
        createTestRepo(source2, ['shared-use-case']);

        const result = getAvailableUseCasesFromSources([source1, source2]);

        expect(result['shared-use-case']?.sources.length).toBe(2);
      } finally {
        cleanupTempDir(source1);
        cleanupTempDir(source2);
      }
    });
  });

  describe('compose', () => {
    it('creates output directory structure', () => {
      const sourceDir = createTempDir();
      const outputDir = join(tempDir, 'output');

      try {
        createTestRepo(sourceDir, ['development']);

        compose({
          sourcePaths: [sourceDir],
          useCases: ['development'],
          outputPath: outputDir,
        });

        expect(existsSync(join(outputDir, '.rulesync'))).toBe(true);
      } finally {
        cleanupTempDir(sourceDir);
      }
    });

    it('copies shared content', () => {
      const sourceDir = createTempDir();
      const outputDir = join(tempDir, 'output');

      try {
        createTestRepo(sourceDir, ['development']);
        createTestFile(
          join(sourceDir, 'shared', 'rules', 'base.md'),
          '# Base Rules'
        );

        compose({
          sourcePaths: [sourceDir],
          useCases: ['development'],
          outputPath: outputDir,
        });

        expect(existsSync(join(outputDir, '.rulesync', 'rules', 'base.md'))).toBe(true);
      } finally {
        cleanupTempDir(sourceDir);
      }
    });

    it('copies use-case specific content', () => {
      const sourceDir = createTempDir();
      const outputDir = join(tempDir, 'output');

      try {
        createTestRepo(sourceDir, ['development']);
        createTestFile(
          join(sourceDir, 'use-cases', 'development', '.rulesync', 'rules', 'dev.md'),
          '# Dev Rules'
        );

        compose({
          sourcePaths: [sourceDir],
          useCases: ['development'],
          outputPath: outputDir,
        });

        expect(existsSync(join(outputDir, '.rulesync', 'rules', 'dev.md'))).toBe(true);
      } finally {
        cleanupTempDir(sourceDir);
      }
    });

    it('throws when no sources provided', () => {
      const outputDir = join(tempDir, 'output');

      expect(() =>
        compose({
          useCases: ['development'],
          outputPath: outputDir,
        })
      ).toThrow('No source paths provided');
    });

    it('logs progress with logger', () => {
      const sourceDir = createTempDir();
      const outputDir = join(tempDir, 'output');
      const logger = createMockLogger();

      try {
        createTestRepo(sourceDir, ['development']);

        compose({
          sourcePaths: [sourceDir],
          useCases: ['development'],
          outputPath: outputDir,
          logger,
        });

        expect(logger.logs.verbose.some((m) => m.includes('Composing'))).toBe(true);
      } finally {
        cleanupTempDir(sourceDir);
      }
    });
  });

  describe('generateRulesyncConfig', () => {
    it('generates basic config', () => {
      const config = generateRulesyncConfig({
        useCases: ['development'],
        targets: ['claudecode'],
        features: ['rules'],
      });

      expect(config.targets).toEqual(['claudecode']);
      expect(config.features).toEqual(['rules']);
      expect(config.baseDirs).toEqual(['.']);
      expect(config.delete).toBe(true);
    });

    it('includes config options when provided', () => {
      const config = generateRulesyncConfig({
        useCases: ['development'],
        targets: ['claudecode'],
        features: ['rules'],
        configOptions: {
          simulateCommands: true,
          modularMcp: true,
        },
      });

      expect(config.simulateCommands).toBe(true);
      expect(config.modularMcp).toBe(true);
    });
  });

  describe('writeRulesyncConfig', () => {
    it('writes config to file', () => {
      const outputDir = join(tempDir, 'output');
      mkdirSync(outputDir, { recursive: true });

      const config = {
        $schema: 'https://example.com/schema.json',
        targets: ['claudecode'],
        features: ['rules'],
        baseDirs: ['.'],
        delete: true,
      };

      const configPath = writeRulesyncConfig(outputDir, config);

      expect(existsSync(configPath)).toBe(true);
      expect(configPath).toBe(join(outputDir, 'rulesync.jsonc'));
    });
  });

  describe('detectProfileType', () => {
    it('returns flat when profile has .rulesync directory', () => {
      const sourceDir = createTempDir();
      try {
        mkdirSync(join(sourceDir, 'writing', '.rulesync'), { recursive: true });
        
        expect(detectProfileType(sourceDir, 'writing')).toBe('flat');
      } finally {
        cleanupTempDir(sourceDir);
      }
    });

    it('returns nested when profile has subdirectories (not _shared or .rulesync)', () => {
      const sourceDir = createTempDir();
      try {
        mkdirSync(join(sourceDir, 'development', 'frontend', '.rulesync'), { recursive: true });
        mkdirSync(join(sourceDir, 'development', 'backend', '.rulesync'), { recursive: true });
        
        expect(detectProfileType(sourceDir, 'development')).toBe('nested');
      } finally {
        cleanupTempDir(sourceDir);
      }
    });

    it('returns flat for legacy use-cases directory', () => {
      const sourceDir = createTempDir();
      try {
        createTestRepo(sourceDir, ['development']);
        
        expect(detectProfileType(sourceDir, 'development')).toBe('flat');
      } finally {
        cleanupTempDir(sourceDir);
      }
    });

    it('ignores _shared when detecting profile type', () => {
      const sourceDir = createTempDir();
      try {
        mkdirSync(join(sourceDir, 'development', '_shared', 'rules'), { recursive: true });
        mkdirSync(join(sourceDir, 'development', 'frontend', '.rulesync'), { recursive: true });
        
        expect(detectProfileType(sourceDir, 'development')).toBe('nested');
      } finally {
        cleanupTempDir(sourceDir);
      }
    });
  });

  describe('composeWithProfiles', () => {
    it('creates output directory structure', () => {
      const sourceDir = createTempDir();
      const outputDir = join(tempDir, 'output');

      try {
        createTestRepo(sourceDir, ['writing']);

        composeWithProfiles({
          sourcePaths: [sourceDir],
          profiles: ['writing'],
          outputPath: outputDir,
        });

        expect(existsSync(join(outputDir, '.rulesync'))).toBe(true);
      } finally {
        cleanupTempDir(sourceDir);
      }
    });

    it('copies global shared content with profile filtering', () => {
      const sourceDir = createTempDir();
      const outputDir = join(tempDir, 'output');

      try {
        createTestRepo(sourceDir, ['development', 'writing']);
        createTestFile(
          join(sourceDir, 'shared', 'rules', 'all.md'),
          '# For all'
        );
        createTestFile(
          join(sourceDir, 'shared', 'rules', 'dev-only.md'),
          `---
profiles: [development]
---
# Dev only`
        );

        composeWithProfiles({
          sourcePaths: [sourceDir],
          profiles: ['writing'],
          outputPath: outputDir,
        });

        expect(existsSync(join(outputDir, '.rulesync', 'rules', 'all.md'))).toBe(true);
        expect(existsSync(join(outputDir, '.rulesync', 'rules', 'dev-only.md'))).toBe(false);
      } finally {
        cleanupTempDir(sourceDir);
      }
    });

    it('copies flat profile content from legacy use-cases directory', () => {
      const sourceDir = createTempDir();
      const outputDir = join(tempDir, 'output');

      try {
        createTestRepo(sourceDir, ['writing']);
        createTestFile(
          join(sourceDir, 'use-cases', 'writing', '.rulesync', 'rules', 'writing.md'),
          '# Writing Rules'
        );

        composeWithProfiles({
          sourcePaths: [sourceDir],
          profiles: ['writing'],
          outputPath: outputDir,
        });

        expect(existsSync(join(outputDir, '.rulesync', 'rules', 'writing.md'))).toBe(true);
      } finally {
        cleanupTempDir(sourceDir);
      }
    });

    it('copies nested profile content with parent shared filtering', () => {
      const sourceDir = createTempDir();
      const outputDir = join(tempDir, 'output');

      try {
        mkdirSync(join(sourceDir, 'shared', 'rules'), { recursive: true });
        mkdirSync(join(sourceDir, 'development', '_shared', 'rules'), { recursive: true });
        mkdirSync(join(sourceDir, 'development', 'frontend', '.rulesync', 'rules'), { recursive: true });
        mkdirSync(join(sourceDir, 'development', 'backend', '.rulesync', 'rules'), { recursive: true });
        
        createTestFile(join(sourceDir, 'repo.json'), JSON.stringify({ name: 'test', 'use-cases': {} }));
        createTestFile(
          join(sourceDir, 'shared', 'rules', 'global.md'),
          '# Global'
        );
        createTestFile(
          join(sourceDir, 'development', '_shared', 'rules', 'coding.md'),
          `---
profiles: [frontend, backend]
---
# Coding for both`
        );
        createTestFile(
          join(sourceDir, 'development', '_shared', 'rules', 'frontend-only.md'),
          `---
profiles: [frontend]
---
# Frontend only`
        );
        createTestFile(
          join(sourceDir, 'development', 'frontend', '.rulesync', 'rules', 'react.md'),
          '# React Rules'
        );
        createTestFile(
          join(sourceDir, 'development', 'backend', '.rulesync', 'rules', 'api.md'),
          '# API Rules'
        );

        composeWithProfiles({
          sourcePaths: [sourceDir],
          profiles: ['development:frontend'],
          outputPath: outputDir,
        });

        expect(existsSync(join(outputDir, '.rulesync', 'rules', 'global.md'))).toBe(true);
        expect(existsSync(join(outputDir, '.rulesync', 'rules', 'coding.md'))).toBe(true);
        expect(existsSync(join(outputDir, '.rulesync', 'rules', 'frontend-only.md'))).toBe(true);
        expect(existsSync(join(outputDir, '.rulesync', 'rules', 'react.md'))).toBe(true);
        expect(existsSync(join(outputDir, '.rulesync', 'rules', 'api.md'))).toBe(false);
      } finally {
        cleanupTempDir(sourceDir);
      }
    });

    it('supports legacy use-cases frontmatter key', () => {
      const sourceDir = createTempDir();
      const outputDir = join(tempDir, 'output');

      try {
        createTestRepo(sourceDir, ['development']);
        createTestFile(
          join(sourceDir, 'shared', 'rules', 'dev.md'),
          `---
use-cases: [development]
---
# Dev rules`
        );

        composeWithProfiles({
          sourcePaths: [sourceDir],
          profiles: ['development'],
          outputPath: outputDir,
        });

        expect(existsSync(join(outputDir, '.rulesync', 'rules', 'dev.md'))).toBe(true);
      } finally {
        cleanupTempDir(sourceDir);
      }
    });

    it('throws when no sources provided', () => {
      const outputDir = join(tempDir, 'output');

      expect(() =>
        composeWithProfiles({
          profiles: ['development'],
          outputPath: outputDir,
        })
      ).toThrow('No source paths provided');
    });
  });
});
